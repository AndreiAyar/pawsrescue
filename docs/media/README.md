# About these demos

The app walkthroughs are captured from the real local PawsRescue application,
in English at a 1280 × 800 browser viewport. Remotion provides the background,
camera zooms, animated cursor, captions, and transitions. Waiting time is shortened.
The screenshots show real UI states and responses from the running application.
The AI pipeline animation is an explanatory diagram, described below.

- `01-report.gif`: create the fictional Nori report, with a representative cat
  photo, an example.com email address, and a last-seen pin at Piața Victoriei.
- `02-map.gif`: explore central Timișoara, zoom into the map, select Pufi near
  Parcul Rozelor, inspect the report, and find it in the list.
- `03-photo-match.gif`: submit Pufi’s listing photo to the real matching endpoint,
  review its ranked result, check the associated map, and open the original report.

The photo match is a same-image sanity check. It does not demonstrate accuracy
with unseen photos or confirm an animal’s identity. The UI displays a transformed
cosine similarity score, not a calibrated probability.

The walkthroughs were recorded with a simulated location in central Timișoara.
That recording-only override has been removed from the app. Location controls
now use the browser’s normal geolocation API and permission prompt.

## AI pipeline illustration

`04-ai-scan.gif` is a Remotion illustration, not an extra application screen.
The top-to-bottom scan line and feature animation explain the processing steps.
The source photo, detected box, padded crop, feature values, and closest report
come from the running local pipeline. The closest report is Pufi #667.

Faster R-CNN ResNet50 FPN v2 detects the cat and returns its bounding box. The
service adds 8% padding and crops that region. DINOv2 Small extracts features
from both the crop and the full image, combined with weights of 80% and 20%.
If no cat is detected confidently, the full image is used instead. pgvector
compares the result with reports using the same embedding model and ranks them
by cosine distance.

`05-map-clusters.gif` records real cluster clicks in Timișoara: groups split
into smaller groups and individual pins, ending at Nala’s report. MapTiler
provides the map and geocoding; Supercluster groups GeoJSON report points.
The client requests visible areas by tile coordinates and caches report data.

## Photos

The animals, names, and example.com contacts in the walkthroughs are fictional.
The photos do not depict actual missing animals associated with those reports.

- Pufi: [original Unsplash photo](https://images.unsplash.com/photo-1511044568932-338cba0ad803).
- Nala: [original Unsplash photo](https://images.unsplash.com/photo-1573865526739-10659fec78a5).
- Mișu (pipeline candidate): [original Unsplash photo](https://images.unsplash.com/photo-1518791841217-8f162f1e1131).
- Nori: [original Unsplash photo](https://images.unsplash.com/photo-1533738363-b7f9aef128ce).
- [All existing demo photo sources](../../scripts/demo-photo-sources.json).
- [Unsplash license](https://unsplash.com/license).

## Local authoring

At the owner’s request, the editable Remotion project, its dependencies, and
full-size MP4 exports are kept outside this repository and delivered separately.
Only the final README assets belong here. Project code is [MIT licensed](../../LICENSE);
photos and fonts retain the terms listed in [third-party notices](../../THIRD_PARTY_NOTICES.md).
