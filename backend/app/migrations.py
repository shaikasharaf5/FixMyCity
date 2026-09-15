"""Additive schema upgrades for existing project databases (no data resets)."""
from sqlalchemy import inspect, text

def upgrade_complaint_workflow(engine):
    columns = {column['name'] for column in inspect(engine).get_columns('complaints')}
    additions = {'verification_outcome': 'VARCHAR', 'verification_notes': 'TEXT',
                 'verified_at': 'DATETIME', 'proceeded_at': 'DATETIME'}
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in columns:
                connection.execute(text(f'ALTER TABLE complaints ADD COLUMN {name} {sql_type}'))
