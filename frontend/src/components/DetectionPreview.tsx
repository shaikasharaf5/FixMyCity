import { LoaderCircle, ScanLine } from 'lucide-react';

type Detection = { category: string; confidence: number; bbox_normalized: number[] };
export function DetectionPreview({ src, scanning, locating, detections = [] }: {
  src: string; scanning: boolean; locating: boolean; detections?: Detection[];
}) {
  const boxes = detections.filter(item => item.bbox_normalized?.length === 4 && item.bbox_normalized.every(Number.isFinite));
  return <div className={'detection-preview ' + (scanning ? 'is-scanning' : '')} aria-busy={scanning || locating}>
    <div className="detection-image-frame"><img src={src} alt="Civic issue selected for analysis" />
      {!scanning && boxes.length > 0 && <svg className="detection-boxes" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="AI-predicted issue areas">{boxes.map((box, index) => {
        const [x1,y1,x2,y2] = box.bbox_normalized.map(value => Math.max(0,Math.min(1,value)) * 100);
        return <rect key={index} x={x1} y={y1} width={Math.max(0,x2-x1)} height={Math.max(0,y2-y1)} />;
      })}</svg>}
      {scanning && <div className="detection-sweep" aria-hidden="true" />}
    </div>
    <div className="detection-caption" role="status">{scanning || locating ? <><LoaderCircle className="detect-spinner" />{locating ? 'Detecting location… Image scan starts next.' : 'Detecting the issue… Analysing your photo.'}</> : boxes.length ? <><ScanLine />Approximate matching area highlighted · review before submitting</> : 'Photo ready for review'}</div>
  </div>;
}
