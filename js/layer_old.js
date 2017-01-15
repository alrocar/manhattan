map.prototype.draw = function(ctx, mapCenter) {
    empty();

    var feature;
    var currentResolution = this.getResolution();
    var minX = (mapCenter.x - (mapWidth / 2 * currentResolution));
    var maxX = (mapCenter.x + (mapWidth / 2 * currentResolution));
    var minY = (mapCenter.y - (mapHeight / 2 * currentResolution));
    var maxY = (mapCenter.y + (mapHeight / 2 * currentResolution));
    
    var totalPixels = 0,
        tt = 0,
        totalFeatures = 0;
    console.time('draw');

    var viewPortBounds = getViewportBounds();
    for (var i = 0, l = dataset.features.length; i < l; i++) {
        // console.log(i);
        feature = dataset.features[i];

        if (!intersects(viewPortBounds, feature.bbox)) {
            continue;
        }

        totalFeatures++;

        var color = style.getColor(feature);
        var polygon, coord, pixel;
        var lastPixel;
        for (var j = 0, ll = feature.geometry.coordinates[0].length; j < ll; j++) {
            polygon = feature.geometry.coordinates[0][j];
            ctx.fillStyle = color;
            lastPixel = null;
            ctx.beginPath();
            for (var k = 0, lll = polygon.length; k < lll; k++) {
                coord = polygon[k];

                // console.log('map: ' + coord[0] + ',' + coord[1]);
                // coord = degrees2meters(coord[0], coord[1]);
                pixel = toPixel({
                    x: coord[0],
                    y: coord[1]
                }, minX, maxY, this.getResolution());

                // if (pxs[pixel.x]) {
                // 	if (pxs[pixel.x][pixel.y] > 3) {
                // 		continue;
                // 	}
                // } else {
                // 	pxs[pixel.x] = {};
                // 	pxs[pixel.x][pixel.y] = 0;
                // }

                // pxs[pixel.x][pixel.y] = pxs[pixel.x][pixel.y] + 1;

                totalPixels++;

                if (!lastPixel) {
                    lastPixel = pixel;
                } else {
                    if (pixel.x == lastPixel.x && pixel.y == lastPixel.y && k != lll - 1) {
                        tt++;
                        continue;
                    } else {
                        lastPixel = pixel;
                    }
                }

                // console.log(pixel.x + ',' + pixel.y);

                if (lll <= 2) {
                    ctx.beginPath();
                    ctx.arc(pixel.x, pixel.y, 1, 0, 2 * Math.PI, true);
                    ctx.fill();
                }

                if (!k) {
                    ctx.moveTo(pixel.x, pixel.y);
                } else {
                    ctx.lineTo(pixel.x, pixel.y);
                }

                if (k == lll - 1) {
                    // if (lll == 2) {
                    // 	ctx.stroke();
                    // } else {
                    ctx.fill('evenodd');
                    // }

                }
            }
        }
    }

    console.timeEnd('draw');

    t1 = new Date().getTime();
    // ctx.putImageData(bufferCtx.getImageData(0,0,mapWidth,mapHeight), 0, 0);
    console.log('canvas ' + (new Date().getTime() - t1));

    console.log('totalPixels: ' + totalPixels);
    console.log('simplifications: ' + tt);
    console.log('totalFeatures: ' + totalFeatures);
};