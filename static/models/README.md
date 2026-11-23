# Modular timber `.glb` assets

Drop a single file named **`gazebo_modules.glb`** here (Draco-compressed is fine –
decoders are served from `/static/draco/`). When present it is loaded automatically by
`GazeboAssembly`; when absent the app renders detailed procedural geometry.

## Node-name contract (Blender object names; `.001` suffixes are ignored)

| Node                | Modelled as                                   | How the engine fits it                              |
|---------------------|-----------------------------------------------|-----------------------------------------------------|
| `Post_Corner`       | one 140 x 140 mm post, any height             | scaled **only on Y** to wall height (XZ pinned)     |
| `Wall_Solid`        | one tongue-and-groove module, ~1 m wide       | tiled along the span (also used for 90 cm half-wall)|
| `Wall_Louver`       | one louver module, ~1 m wide                  | tiled along the span                                |
| `Door_SlidingGlass` | one glass panel with frame (mesh named `*glass*` gets the physical glass material) | cloned per panel |
| `Roof_Pyramid`      | unit pyramid roof                             | scaled to roof footprint x peak height              |
| `Deck_Floor`        | floor slab                                    | scaled to width x depth                             |

Every part's pivot is normalised (centred X/Z, base on Y=0). Materials are replaced
by the site's PBR library so wood stain / roof covering swatches keep working.
