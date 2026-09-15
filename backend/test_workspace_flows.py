"""Isolated regression checks. No live database, AI weights, or outbound messaging."""
import asyncio
import importlib
import tempfile
import unittest
from io import BytesIO
from PIL import Image
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app import auth, models
from app.database import Base, get_db
from app.routers import locations


class WorkspaceFlows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # These tests exercise routing, persistence, and access control, not the detector.
        with patch.dict('sys.modules', {'app.ai.detector': ModuleType('app.ai.detector')}):
            cls.routes = importlib.import_module('app.routers.complaints')

    def setUp(self):
        photo = BytesIO()
        Image.new('RGB', (16, 16), 'green').save(photo, format='PNG')
        self.photo = ('on-site.png', photo.getvalue(), 'image/png')
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.admin = models.User(username='central', email='central@example.com', hashed_password='unused', role='state_admin')
        self.officer = models.User(username='assigned', email='assigned@example.com', hashed_password='unused', role='officer')
        self.other = models.User(username='other', email='other@example.com', hashed_password='unused', role='officer')
        self.dept = models.Department(name='Roads & Buildings', code='RND')
        self.db.add_all([self.admin, self.officer, self.other, self.dept]); self.db.commit()
        self.profile = models.Officer(user_id=self.officer.id, department_id=self.dept.id, district='Hyderabad')
        self.other_profile = models.Officer(user_id=self.other.id, department_id=self.dept.id, district='Hyderabad')
        self.db.add_all([self.profile, self.other_profile]); self.db.commit()
        self.case = models.Complaint(category='Pothole', severity='high', description='Road damage', latitude=17.4485, longitude=78.3741, district='Hyderabad', ward='Madhapur', before_image_url='/uploads/test.jpg', department_id=self.dept.id, status='pending')
        self.db.add(self.case); self.db.commit()
        self.current = self.admin
        app = FastAPI()
        app.include_router(self.routes.router)
        app.include_router(locations.router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[auth.get_current_user] = lambda: self.current
        self.client = TestClient(app)
        self.temp = tempfile.TemporaryDirectory(prefix='civitrack-workflow-test-')
        self.upload_patch = patch.object(self.routes, 'UPLOAD_DIR', self.temp.name)
        self.notify_patch = patch.object(self.routes, 'notify_citizen_status_whatsapp', new=AsyncMock())
        self.upload_patch.start(); self.notify_patch.start()

    def tearDown(self):
        self.notify_patch.stop(); self.upload_patch.stop()
        self.client.close(); self.db.close(); self.engine.dispose(); self.temp.cleanup()

    def test_assign_start_complete_and_enforce_ownership(self):
        url = f'/api/complaints/{self.case.id}'
        result = self.client.put(url, json={'status': 'assigned', 'officer_id': self.profile.id})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['assigned_officer']['user']['id'], self.officer.id)
        self.current = self.other
        self.assertEqual(self.client.put(url, json={'status': 'in_progress'}).status_code, 403)
        self.assertEqual(self.client.post(url + '/verify', files={'file': self.photo}, data={'verdict': 'real', 'notes': 'Inspected'}).status_code, 403)
        self.current = self.officer
        self.assertEqual(self.client.put(url, json={'status': 'in_progress'}).status_code, 403)
        self.assertEqual(self.client.post(url + '/proceed').status_code, 403)
        self.assertEqual(self.client.post(url + '/complete', files={'file': self.photo}, data={'notes': 'Skip review'}).status_code, 409)
        self.assertEqual(self.client.post(url + '/verify', files={'file': ('notes.txt', b'text', 'text/plain')}, data={'verdict': 'real', 'notes': 'Inspected'}).status_code, 400)
        result = self.client.post(url + '/verify', files={'file': self.photo}, data={'verdict': 'real', 'notes': 'Inspected the road'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['status'], 'verified')
        self.assertEqual(result.json()['verification_outcome'], 'real')
        self.assertEqual(self.client.post(url + '/complete', files={'file': self.photo}, data={'notes': 'Skip approval'}).status_code, 409)
        self.current = self.admin
        self.assertEqual(self.client.put(url, json={'status': 'assigned', 'officer_id': self.other_profile.id}).status_code, 409)
        result = self.client.post(url + '/proceed')
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['officer_id'], self.profile.id)
        self.assertIsNotNone(result.json()['proceeded_at'])
        self.assertEqual(self.client.post(url + '/proceed').status_code, 409)
        self.current = self.other
        self.assertEqual(self.client.post(url + '/complete', files={'file': self.photo}, data={'notes': 'Wrong officer'}).status_code, 403)
        self.current = self.officer
        self.assertEqual(self.client.post(url + '/complete').status_code, 422)
        result = self.client.post(url + '/complete', files={'file': self.photo}, data={'notes': 'Repair completed'})
        self.assertEqual(result.status_code, 200, result.text)
        self.db.refresh(self.case)
        self.assertEqual(self.case.status, 'resolved')
        self.assertTrue((Path(self.temp.name) / Path(self.case.after_image_url).name).exists())
        details = ' '.join(row.details for row in self.db.query(models.AuditLog).all())
        self.assertIn('Inspected the road', details)
        self.assertIn('Repair completed', details)
        self.assertEqual(self.client.post(url + '/complete', files={'file': self.photo}, data={'notes': 'Repeat'}).status_code, 409)

    def test_fake_inspection_is_declined_and_cannot_proceed(self):
        url = f'/api/complaints/{self.case.id}'
        self.assertEqual(self.client.post(url + '/proceed').status_code, 409)
        self.client.put(url, json={'status': 'assigned', 'officer_id': self.profile.id})
        self.current = self.officer
        self.assertEqual(self.client.post(url + '/verify', files={'file': self.photo}, data={'verdict': 'fake', 'notes': ' '}).status_code, 400)
        result = self.client.post(url + '/verify', files={'file': self.photo}, data={'verdict': 'fake', 'notes': 'No reported defect found at this location.'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['status'], 'rejected')
        self.assertEqual(result.json()['verification_outcome'], 'fake')
        self.current = self.admin
        self.assertEqual(self.client.post(url + '/proceed').status_code, 409)
        self.assertEqual(self.client.put(url, json={'status': 'resolved'}).status_code, 409)

    def test_reverse_lookup_cache_and_validation(self):
        locations._cache.clear()
        locations._lock = asyncio.Lock()
        response = httpx.Response(200, json={'address': {'suburb': 'Madhapur', 'state_district': 'Rangareddy'}}, request=httpx.Request('GET', 'https://example.com'))
        with patch.object(httpx.AsyncClient, 'get', new=AsyncMock(return_value=response)) as remote:
            first = self.client.get('/api/locations/reverse?latitude=17.4485&longitude=78.3741')
            self.assertEqual(first.status_code, 200)
            self.assertEqual(first.json()['place'], 'Madhapur, Rangareddy')
            self.assertEqual(first.json()['latitude'], 17.4485)
            self.client.get('/api/locations/reverse?latitude=17.4485&longitude=78.3741')
            cached = self.client.get('/api/locations/reverse?latitude=17.448501&longitude=78.3741')
            self.assertEqual(cached.json()['latitude'], 17.448501)
            self.assertEqual(remote.await_count, 1)
        self.assertEqual(self.client.get('/api/locations/reverse?latitude=120&longitude=78').status_code, 422)
        with patch.object(httpx.AsyncClient, 'get', new=AsyncMock(side_effect=httpx.ConnectError('offline'))):
            self.assertEqual(self.client.get('/api/locations/reverse?latitude=18&longitude=79').status_code, 503)


if __name__ == '__main__':
    unittest.main()
