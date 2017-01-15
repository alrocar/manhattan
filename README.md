DONE

- Make it work
- Add zoom buttons
- Implement panning
- Add double buffer in the canvas
- Generate vector tiles and index to improve drawing speed
- Add thematic support in the drawing
- Include in the SQL the_geom and the field necessary for a thematic
- Measure and compare rendering times
- Make it nice

EXTRAS

- Use WebWorkers to load data in the background
- Use WebWorkers to draw in the buffer canvas and send the image to be rendered to the main thread. When using tiles this can be done for every tile.
- Add support for geometry simplification to improve drawing speed
- Add base layer (tiles) support
- Add mousewheel support for zooming
- Add continuous zoom support
- Add an input for the SQL and a button to request data
- Add progress bar or icon when loading the dataset