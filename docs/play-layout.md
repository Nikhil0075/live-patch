# Play and OBS overlay layout map

At 1920 × 1080, keep the center of the game clear.

| Region | Owner | Content |
| --- | --- | --- |
| Left 24–420 px, top 16–100 px | Game window | Game title and HUD status |
| Right 1480–1896 px, top 16–100 px | Game window | Sound, full screen and menu controls; these fade after 3 seconds |
| Center 720–1200 px, top 80–150 px | Game window | Ship, rollback and failure toast |
| Left 24–600 px, bottom 120–520 px | OBS overlay | Ballot and voting hints |
| Right 1470–1896 px, below 160 px | OBS overlay | Codex progress |
| Bottom 24–1050 px, 24–95 px | Game window | Key hint; fades after 3 seconds |
| Bottom 110–1896 px, 24–95 px | OBS overlay | Pitch ticker |

The overlay is a separate OBS browser source composited over `/play`. The overlay never receives a game handle and must not mount another game instance.

Arena Survivor uses a 1152 × 648 (16:9) canvas so it fills a 1920 × 1080 capture. Other games choose their own canvas dimensions. The positions above are the default OBS widget layout. In Go Live → OBS overlay layout, widgets can be added, removed, dragged and resized; the saved layout appears in the OBS browser source. Keep the HUD and toast regions clear when customizing it.
