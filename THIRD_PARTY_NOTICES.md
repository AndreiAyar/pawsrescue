# Third-party notices

PawsRescue's original code is [MIT licensed](LICENSE). Dependencies, fonts, model
weights, map data, and stock photos retain their own licenses and terms.

| Material                                          | Terms and attribution                                                                                                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turborepo / Next.js starter                       | MIT, Vercel. [Preserved notice](docs/licenses/VERCEL-MIT.txt).                                                                                                                                                          |
| Bundled Geist and Geist Mono fonts, version 1.200 | Copyright 2023 Vercel, in collaboration with basement.studio. [SIL Open Font License 1.1](docs/licenses/GEIST-OFL-1.1.txt), from [upstream version 1.2.0](https://github.com/vercel/geist-font/blob/1.2.0/LICENSE.txt). |
| Demo animal photos                                | [Sources and credits](scripts/demo-photo-sources.json), under the [Unsplash license](https://unsplash.com/license). Demo reports are fictional.                                                                         |
| DINOv2 Small weights                              | Meta's [`facebook/dinov2-small`](https://huggingface.co/facebook/dinov2-small), Apache 2.0. Downloaded at runtime, not bundled in Git.                                                                                  |
| Faster R-CNN detector                             | Torchvision code is BSD licensed; pretrained weights have separate provenance. See [Torchvision's model and weight terms](https://docs.pytorch.org/vision/stable/models.html). Downloaded at runtime.                   |
| Map renderer and tiles                            | MapLibre GL JS is BSD licensed; MapTiler SDK is BSD licensed. Hosted MapTiler services and map data retain their terms and visible attribution. Use your own API key.                                                   |

The copied MapLibre web workers include their upstream license beside the
generated files. Keep that file when deploying them.

Other npm and Python dependencies carry licenses in their installed packages;
the lockfile and requirements files identify the versions used. For example,
Sharp's native image stack includes libvips under LGPL 3.0. Preserve its bundled
notices and comply with the applicable terms when redistributing binaries or
container images. The project's MIT license does not replace those licenses.

Before adding an asset or dependency, record its source and check that its
terms permit the intended use. User-uploaded photos are runtime data and are
not relicensed under MIT by this repository.
