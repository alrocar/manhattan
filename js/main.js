//projection.js
//tiler.js
//worker.js
//cache.js
//thematic.js
//draw.js
//pan.js
//zoom.js
var baseUrl = "https://rambo-test.carto.com/api/v2/";
var query = "select the_geom, lot, cartodb_id from public.mnmappluto";
var dataUrl = baseUrl + "sql?format=GeoJSON&q=" + query;

var resolutions = [],
    mresolutions = [];
var MAX_ZOOM_LEVEL = 17;

var mapCenter = {
    x: -73.964767,
    y: 40.781841
};

var pxs = {};

var zoomLevel = 12;
var thematicAttribute = 'lot';
var thematicLevels = 7;
var thematicOffset;
var colorRamp = ['#FFFFCC', '#C7E9B4', '#7FCDBB', '#41B6C4', '#1D91C0', '#225EA8', '#0C2C84'];

var bbox = [];
var tiles;
var ratio = devicePixelRatio;
var deltaX = 0,
    deltaY = 0;

var _features = {};
var drawn = {}

function preprocess(features) {
    var feature, polygon, minX, minY, maxX, maxY, coord;
    var datasetMinX = Infinity,
        datasetMinY = Infinity,
        datasetMaxX = -Infinity,
        datasetMaxY = -Infinity;
    var proj;
    for (var i = 0, l = features.length; i < l; i++) {
        minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        feature = features[i];
        for (var j = 0, ll = feature.geometry.coordinates[0].length; j < ll; j++) {
            polygon = feature.geometry.coordinates[0][j];
            // feature.geometry.coordinates[0][j] = simplify(polygon, 3);
            for (var k = 0, lll = polygon.length; k < lll; k++) {
                coord = polygon[k];
                proj = degrees2meters(coord[0], coord[1]);
                coord[0] = proj.x;
                coord[1] = proj.y;
                if (isNaN(coord[0])) continue;
                minX = Math.min(coord[0], minX);
                minY = Math.min(coord[1], minY);
                maxX = Math.max(coord[0], maxX);
                maxY = Math.max(coord[1], maxY);

                datasetMinX = Math.min(datasetMinX, minX);
                datasetMinY = Math.min(datasetMinY, minY);
                datasetMaxX = Math.max(datasetMaxX, maxX);
                datasetMaxY = Math.max(datasetMaxY, maxY);
            }
            feature.bbox = [minX, minY, maxX, maxY];
            feature.area = calcArea(polygon);
        }
        _features[feature.properties.cartodb_id] = feature;
    }

    bbox = [datasetMinX, datasetMinY, datasetMaxX, datasetMaxY];

    mapCenter.x = (bbox[2] + bbox[0]) / 2;
    mapCenter.y = (bbox[3] + bbox[1]) / 2;

    // mapCenterMercator = degrees2meters(mapCenter.x, mapCenter.y);

    tiles = {};
    var f, id;
    // for (var i = zoomLevel, l = MAX_ZOOM_LEVEL; i < l; i++) {
    var tile = getCenterTile(zoomLevel);
    // createTile(tiles, tile, features);
    var stack = new Array(),
        t;
    stack.push(tile);

    spiral(Math.ceil(mapWidth * ratio / 256), Math.ceil(mapHeight * ratio / 256), function(x, y) {
        var nextTile = {
            x: tile.x + x,
            y: tile.y + y,
            z: tile.z
        };

        t = createTile(tiles, nextTile, features);
        if (t) {
            stack.push(t);
        }

    });
    // }

    while (stack.length) {
        tile = stack.pop();

        if (!tile.features) {
            continue;
        }

        spiral(2, 2, function(x, y) {
            var nextTile = {
                x: tile.x * 2 + x,
                y: tile.y * 2 + y,
                z: tile.z + 1
            };


            t = createTile(tiles, nextTile, tile.features);
            if (t && t.z < MAX_ZOOM_LEVEL) {
                stack.push(t);
            }


        });
    }
    var a = 0;
};

function createTile(tiles, tile, features) {
    var id = getId(tile),
        n, points;

    if (tiles[id]) {
        return;
    }

    var tileBounds = getTileBounds(tile.x, tile.y, tile.z),
        f;
    for (var j = 0, ll = features.length; j < ll; j++) {
        f = features[j];
        if (!f.bbox) {
        	f = _features[features[j]];
        }

        if (intersects(f.bbox, tileBounds)) {
            if (!tiles[id]) {
                tiles[id] = {
                    features: [],
                    x: tile.x,
                    y: tile.y,
                    z: tile.z
                };
            }

            // n = {
            //     properties: f.properties,
            //     geometry: f.geometry,
            //     bbox: f.bbox,
            //     area: f.area
            // };


            // points = [];
            // for (var kk = 0, lll = f.geometry.coordinates[0][0].length; kk < lll; kk++) {
            //     var point = f.geometry.coordinates[0][0][kk];
            //     var tt = getTile(tile.z, point[0], point[1]);
            //     points.push([tt.offsetX, tt.offsetY]);
            // }

            // n.points = points;

            tiles[id].features.push(f.properties.cartodb_id);
        }
    }

    return tiles[id];
}

function calcArea(points) {
    var area = 0;

    for (var i = 0, a, b; i < points.length - 1; i++) {
        a = b || points[i];
        b = points[i + 1];

        area += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(area / 2);
}

function getId(tile) {
    return tile.z + ',' + tile.x + ',' + tile.y;
};

function calculateResolutions(zoomLevels) {
    // var maxResolution = 20037508.34 * 2 / 256,
    var maxResolution = 180 * 2 / 256,
        resolution;
    for (var i = 0; i < zoomLevels; i++) {
        if (!resolution) {
            resolution = maxResolution / 2;
        } else {
            resolution /= 2;
        }

        resolutions[i] = resolution;
    }
};

function calculateMercatorResolutions(zoomLevels) {
    var maxResolution = 20037508.34 * 2 / 256,
        // var maxResolution = 180 * 2 / 256,
        resolution;
    for (var i = 0; i < zoomLevels; i++) {
        if (!resolution) {
            resolution = maxResolution / 2;
        } else {
            resolution /= 2;
        }

        mresolutions[i] = resolution;
    }
};

function getViewportBounds() {
    var minX = mapCenter.x - (mapWidth * getResolution());
    var maxX = mapCenter.x + (mapWidth * getResolution());
    var minY = mapCenter.y - (mapHeight * getResolution());
    var maxY = mapCenter.y + (mapHeight * getResolution());

    return [minX, minY, maxX, maxY];
};

function getResolution() {
    return mresolutions[zoomLevel] * ratio;
};

function toPixel(coordinate, minX, maxY, resolution) {
    if (!resolution) {
        resolution = getResolution();
    }

    return {
        x: Math.ceil(1 / resolution * (coordinate.x - minX)),
        y: Math.ceil(1 / resolution * (maxY - coordinate.y))
    }
};

function toPixel2(coord, zoomLevel) {
    var res = 180 / 256.0 / (1 << zoomLevel);
    var px = (180 + coord.y) / res;
    var py = (90 + coord.x) / res;

    return {
        x: px,
        y: py
    };
}


function toCoordinate(pixel) {
    deltaX = pixel.x - (mapWidth / 2);
    deltaY = pixel.y - (mapHeight / 2)

    var m = {
        x: mapCenter.x + deltaX * mresolutions[zoomLevel],
        y: mapCenter.y - deltaY * mresolutions[zoomLevel]
    };

    return m;

    // return metersToLatLon(m.x, m.y);
}


function metersToLatLon(mx, my) {
    var lon = (mx / 20037508.34) * 180.0
    var lat = (my / 20037508.34) * 180.0

    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0)
    return {
        x: lon,
        y: lat
    };
};


function getCenterTile(zoom) {
    return getTile(zoom, mapCenter.x, mapCenter.y);
}

function getTile(zoom, x, y) {
    if (!zoom) {
        zoom = zoomLevel;
    }

    // var tx = lon2tile(x, zoom);
    // var ty = lat2tile(y, zoom);

    // var p = { x: tx, y: ty };



    // /** mercator **/
    // var m = degrees2meters(x, y);

    var p = metersToTile(x, y);
    /** mercator **/

    var offsetY = Math.floor((p.y - Math.floor(p.y)) * 256);
    var offsetX = Math.floor((p.x - Math.floor(p.x)) * 256);

    return {
        x: Math.floor(p.x),
        y: Math.floor(p.y),
        offsetX: offsetX,
        offsetY: offsetY,
        z: zoom
    };
}

function pixelsToTile(px, py, zoom) {
    if (!zoom) {
        zoom = zoomLevel;
    }

    var tx = (px / 256);
    var ty = (py / 256) - 1;

    ty = ((1 << zoom) - 1) - ty;

    return {
        x: tx,
        y: ty
    };
};

function metersToPixels(mx, my, zoom) {
    if (!zoom) {
        zoom = zoomLevel;
    }

    var res = 2 * Math.PI * 6378137 / 256 / (1 << zoom);
    var px = (mx + 20037508.34) / res
    var py = (my + 20037508.34) / res
    return {
        x: px,
        y: py
    };
};

function metersToTile(mx, my, zoom) {
    if (!zoom) {
        zoom = zoomLevel;
    }

    var p = metersToPixels(mx, my, zoom);
    return pixelsToTile(p.x, p.y);
};

function degrees2meters(lon, lat) {
    var x = lon * 20037508.34 / 180;
    var y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;

    return {
        'x': x,
        'y': y
    };
};

var /*dataset,*/ mapWidth, mapHeight;
var lastPanPosition, panOrigin;

$(document).ready(function() {
    var canvas = $('#map');
    cv = canvas[0];
    canvas.attr({ width: canvas.width(), height: canvas.height() });
    buffer = canvas.clone();



    var ctx = canvas[0].getContext('2d');
    bufferCtx = buffer[0].getContext('2d');

    if (ratio > 1) {
        canvas[0].style.width = canvas[0].width + 'px';
        canvas[0].style.height = canvas[0].height + 'px';
        canvas[0].width *= ratio;
        canvas[0].height *= ratio;
        ctx.scale(ratio, ratio);
    }

    mapWidth = canvas.width();
    mapHeight = canvas.height();

    calculateResolutions(MAX_ZOOM_LEVEL);
    calculateMercatorResolutions(MAX_ZOOM_LEVEL);

    $.getJSON(dataUrl, function(data) {
        dataset = data;

        preprocess(dataset.features);

        prepare(dataset);


        lastPanPosition = {
            x: mapWidth / 2,
            y: mapHeight / 2
        };

        // mapCenter = degrees2meters(mapCenter.x, mapCenter.y);
        console.log('center: ' + mapCenter.x + ', ' + mapCenter.y);

        $('.zoom_in').on('click', function(e) {
            zoomLevel++;
            // mapCenter = toCoordinate({x: e.pageX * 2, y: e.pageY * 2});
            draw(ctx, mapCenter);
        });

        $('.zoom_out').on('click', function(e) {
            zoomLevel--;
            // mapCenter = toCoordinate({x: e.pageX * 2, y: e.pageY * 2});
            draw(ctx, mapCenter);
        });

        canvas.on("mousedown", function(e) {
            panOrigin = {
                x: e.pageX * ratio,
                y: e.pageY * ratio
            };

            // console.log('panOrigin; ' + (panOrigin.x) + ', ' + panOrigin.y);

            lastPanPosition = {
                x: e.pageX * ratio,
                y: e.pageY * ratio
            };

            canvas.on("mousemove", function(e) {
                // console.log(e.pageY * ratio + ',' + e.pageX * ratio);
                // var newMapCenter = toCoordinate({x: e.pageX * ratio, y: e.pageY * ratio});
                // draw(ctx, newMapCenter);
                var translateTo = {
                    x: e.pageX * ratio - lastPanPosition.x,
                    y: e.pageY * ratio - lastPanPosition.y
                };

                lastPanPosition = {
                    x: e.pageX * ratio,
                    y: e.pageY * ratio
                };


                var imgData = ctx.getImageData(0, 0, mapWidth * ratio, mapHeight * ratio);
                empty(ctx);
                ctx.putImageData(imgData, translateTo.x, translateTo.y);
                // console.log('pan: ' + lastPanPosition.x + ',' + lastPanPosition.y);
            });
        }).on("mouseup", function(e) {
            // mapCenter = toCoordinate({x: e.pageX * ratio, y: e.pageY * ratio});
            // draw(ctx, mapCenter);
            canvas.off("mousemove");

            var translateTo = {
                x: e.pageX * ratio - lastPanPosition.x,
                y: e.pageY * ratio - lastPanPosition.y
            };

            lastPanPosition = {
                x: e.pageX * ratio,
                y: e.pageY * ratio
            };

            // console.log('lastPan; ' + (lastPanPosition.x) + ', ' + lastPanPosition.y);


            var imgData = ctx.getImageData(0, 0, mapWidth * ratio, mapHeight * ratio);
            empty(ctx);
            ctx.putImageData(imgData, translateTo.x, translateTo.y);

            // console.log('pxx ' + (lastPanPosition.x - panOrigin.x) + ', ' + (lastPanPosition.y - panOrigin.y) );
            var newCenterPx = (mapWidth / 2) - (lastPanPosition.x - panOrigin.x);
            var newCenterPy = (mapHeight / 2) - (lastPanPosition.y - panOrigin.y);
            // mapCenter.x -= (lastPanPosition.x - panOrigin.x) * getResolution();
            // mapCenter.y -= (lastPanPosition.y - panOrigin.y) * getResolution();
            mapCenter = toCoordinate({
                x: newCenterPx,
                y: newCenterPy
            });

            draw(ctx, mapCenter);

            console.log('center: ' + mapCenter.x + ', ' + mapCenter.y);
        });

        draw(ctx, mapCenter);
    });
});

function prepare(dataset) {
    var feature;
    var minRange = Number.MAX_VALUE,
        maxRange = Number.MIN_VALUE;
    for (var i = 0, l = dataset.features.length; i < l; i++) {
        feature = dataset.features[i];

        if (feature.properties[thematicAttribute]) {
            if (feature.properties[thematicAttribute] < minRange) {
                minRange = feature.properties[thematicAttribute];
            }

            if (feature.properties[thematicAttribute] > minRange) {
                maxRange = feature.properties[thematicAttribute];
            }
        }
    }

    thematicOffset = (maxRange - minRange) / thematicLevels;
};

function draw(ctx, mapCenter) {
    draw2(ctx, mapCenter);
    return;
    empty(ctx);

    var feature;
    var currentResolution = getResolution();
    var minX = (mapCenter.x - (mapWidth / 2 * currentResolution));
    var maxX = (mapCenter.x + (mapWidth / 2 * currentResolution));
    var minY = (mapCenter.y - (mapHeight / 2 * currentResolution));
    var maxY = (mapCenter.y + (mapHeight / 2 * currentResolution));

    // console.log(minX);
    // console.log(maxX);
    // console.log(minY);
    // console.log(maxY);
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

        var colorIndex = feature.properties[thematicAttribute] & thematicOffset;
        var color = colorRamp[Math.floor(colorIndex)];
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
                }, minX, maxY);

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

    var tile = getCenterTile();
    var offsetX = tile.offsetX;
    var offsetY = tile.offsetY;

    spiral(mapWidth / 256, mapHeight / 256, function(x, y) {
        var leftTop = {
            x: (mapWidth / 2) - offsetX + (256 * x),
            y: (mapHeight / 2) - offsetY + (256 * y)
        };

        leftTop.x = prepareDrawingX(leftTop.x);
        leftTop.y = prepareDrawingX(leftTop.y);

        ctx.beginPath();
        ctx.moveTo(prepareDrawingX(leftTop.x), prepareDrawingY(leftTop.y));
        ctx.lineTo(prepareDrawingX(leftTop.x + 256), prepareDrawingY(leftTop.y));
        ctx.lineTo(prepareDrawingX(leftTop.x + 256), prepareDrawingY(leftTop.y + 256));
        ctx.lineTo(prepareDrawingX(leftTop.x), prepareDrawingY(leftTop.y + 256));
        ctx.lineTo(prepareDrawingX(leftTop.x), prepareDrawingY(leftTop.y));
        ctx.stroke();
    });

    ctx.fillRect(mapWidth / 2, mapHeight / 2, 10, 10);
};

function prepareDrawingX(x) {
    return x;
    if (x < 0) {
        return 256;
    }

    if (x > mapWidth / 2) {
        return mapWidth / 2;
    }

    return x;
}

function prepareDrawingY(y) {
    return y;
    if (y < 0) {
        return 0;
    }

    if (y > mapHeight / 2) {
        return mapHeight / 2;
    }

    return y;
}

function draw2(ctx, mapCenter) {
    empty(ctx);

    var currentResolution = getResolution();
    var minX = (mapCenter.x - (mapWidth / 2 * currentResolution));
    var maxX = (mapCenter.x + (mapWidth / 2 * currentResolution));
    var minY = (mapCenter.y - (mapHeight / 2 * currentResolution));
    var maxY = (mapCenter.y + (mapHeight / 2 * currentResolution));

    var totalPixels = 0,
        tt = 0,
        totalFeatures = 0,
        area = 0,
        fromCache = 0,
        totalDrawn = 0;
    console.time('draw');

    var tile = getCenterTile(),
        feature;

    console.log('center offset ' + tile.offsetX + ', ' + tile.offsetY);

    ctx.beginPath();
    ctx.rect(0, 0, mapWidth, mapHeight);
    ctx.stroke();

    spiral(Math.ceil(mapWidth / 256 + 1), Math.ceil(mapHeight / 256 + 1), function(x, y) {
        var t = tiles[zoomLevel + ',' + (tile.x + x) + ',' + (tile.y + y)];
        if (!t) {
            return;
        }

        var tileOffsetX = (mapWidth / 2) - tile.offsetX + (256 * x);
        var tileOffsetY = (mapHeight / 2) - tile.offsetY + (256 * y);

        if (t.imageData && t.imageData.data.length) {
            ctx.putImageData(t.imageData, tileOffsetX * ratio, tileOffsetY * ratio);
            fromCache++;
            return;
        }

        for (var i = 0, l = t.features.length; i < l; i++) {
            feature = _features[t.features[i]];

            if (drawn[feature.properties.cartodb_id]) {
                totalDrawn++;
                continue;
            }
            drawn[feature.properties.cartodb_id] = true;
            if (feature.area < currentResolution) {
                area++;
                continue;
            }
            totalFeatures++;

            var colorIndex = feature.properties[thematicAttribute] & thematicOffset;
            var color = colorRamp[Math.floor(colorIndex)];
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
                    }, minX, maxY);

                    totalPixels++;

                    if (!lastPixel) {
                        lastPixel = pixel;
                    } else {
                        if (pixel.x == lastPixel.x && pixel.y == lastPixel.y && j != ll - 1) {
                            tt++;
                            continue;
                        } else {
                            lastPixel = pixel;
                        }
                    }

                    // console.log(pixel.x + ',' + pixel.y);

                    if (!k) {
                        ctx.moveTo(pixel.x, pixel.y);
                    } else {
                        ctx.lineTo(pixel.x, pixel.y);
                    }
                }
                ctx.fill('evenodd');
            }
        }

        if (contains([0, 0, mapWidth, mapHeight], [tileOffsetX, tileOffsetY, tileOffsetX + 256, tileOffsetY + 256])) {
            t.imageData = ctx.getImageData(tileOffsetX * ratio, tileOffsetY * ratio, 256 * ratio, 256 * ratio);
            localStorage.setItem(zoomLevel + ',' + (tile.x + x) + ',' + (tile.y + y), t.imageData);
        }
    });

    console.timeEnd('draw');

    t1 = new Date().getTime();
    // ctx.putImageData(bufferCtx.getImageData(0,0,mapWidth,mapHeight), 0, 0);
    console.log('canvas ' + (new Date().getTime() - t1));

    console.log('totalPixels: ' + totalPixels);
    console.log('simplifications: ' + tt);
    console.log('totalFeatures: ' + totalFeatures);
    console.log('totalArea: ' + area);
    console.log('fromCache: ' + fromCache);
    console.log('drawn: ' + totalDrawn);

    var tile = getCenterTile();
    var offsetX = tile.offsetX;
    var offsetY = tile.offsetY;

    spiral(Math.ceil(mapWidth / 256 + 1), Math.ceil(mapHeight / 256 + 1), function(x, y) {
        var leftTop = {
            x: (mapWidth / 2) - offsetX + (256 * x),
            y: (mapHeight / 2) - offsetY + (256 * y)
        };

        ctx.beginPath();
        ctx.moveTo(leftTop.x, leftTop.y);
        ctx.lineTo(leftTop.x + 256, leftTop.y);
        ctx.lineTo(leftTop.x + 256, leftTop.y + 256);
        ctx.lineTo(leftTop.x, leftTop.y + 256);
        ctx.lineTo(leftTop.x, leftTop.y);
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.fillText((tile.z) + ',' + (tile.x + x) + ',' + (tile.y + y), leftTop.x + 50, leftTop.y + 50);
        ctx.fillText((tile.offsetX + 256 * x) + ',' + (tile.offsetY + 256 * y), leftTop.x + 50, leftTop.y + 100);
    });



    ctx.fillRect(mapWidth / 2, mapHeight / 2, 10, 10);

    // window.location = cv.toDataURL();
};

function draw3(ctx, mapCenter) {
    empty(ctx);

    var currentResolution = getResolution();
    var minX = (mapCenter.x - (mapWidth / 2 * currentResolution));
    var maxX = (mapCenter.x + (mapWidth / 2 * currentResolution));
    var minY = (mapCenter.y - (mapHeight / 2 * currentResolution));
    var maxY = (mapCenter.y + (mapHeight / 2 * currentResolution));

    var totalPixels = 0,
        tt = 0,
        totalFeatures = 0;
    var t1 = new Date().getTime();

    var tile = getCenterTile(),
        feature;

    spiral(Math.ceil(mapWidth / 256 + 1), Math.ceil(mapHeight / 256 + 1), function(x, y) {
        var t = tiles[zoomLevel + ',' + (tile.x + x) + ',' + (tile.y + y)];
        if (!t) {
            return;
        }

        for (var i = 0, l = t.features.length; i < l; i++) {
            feature = t.features[i];
            totalFeatures++;

            var colorIndex = feature.properties[thematicAttribute] & thematicOffset;
            var color = colorRamp[Math.floor(colorIndex)];
            var coord, pixel;
            var lastPixel;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (var j = 0, ll = feature.points.length; j < ll; j++) {
                coord = feature.points[j];
                pixel = {};
                pixel.x = (mapWidth / 2 * ratio) - tile.offsetX + coord[0] + (256 * x);
                pixel.y = (mapHeight / 2 * ratio) - tile.offsetY + coord[1] + (256 * y);

                totalPixels++;

                // if (!lastPixel) {
                //     lastPixel = pixel;
                // } else {
                //     if (pixel.x == lastPixel.x && pixel.y == lastPixel.y && j != ll - 1) {
                //         tt++;
                //         continue;
                //     } else {
                //         lastPixel = pixel;
                //     }
                // }

                // console.log(pixel.x + ',' + pixel.y);

                if (!j) {
                    ctx.moveTo(pixel.x, pixel.y);
                } else {
                    ctx.lineTo(pixel.x, pixel.y);
                }
            }
            ctx.fill();
        }
    });

    console.log('rendering ' + (new Date().getTime() - t1));

    t1 = new Date().getTime();
    // ctx.putImageData(bufferCtx.getImageData(0,0,mapWidth,mapHeight), 0, 0);
    console.log('canvas ' + (new Date().getTime() - t1));

    console.log('totalPixels: ' + totalPixels);
    console.log('simplifications: ' + tt);
    console.log('totalFeatures: ' + totalFeatures);

    var tile = getCenterTile();
    var offsetX = tile.offsetX;
    var offsetY = tile.offsetY;

    spiral(mapWidth / 256, mapHeight / 256, function(x, y) {
        var leftTop = {
            x: (mapWidth / 2) - offsetX + (256 * x),
            y: (mapHeight / 2) - offsetY + (256 * y)
        };

        ctx.beginPath();
        ctx.moveTo(leftTop.x, leftTop.y);
        ctx.lineTo(leftTop.x + 256, leftTop.y);
        ctx.lineTo(leftTop.x + 256, leftTop.y + 256);
        ctx.lineTo(leftTop.x, leftTop.y + 256);
        ctx.lineTo(leftTop.x, leftTop.y);
        ctx.stroke();
    });

    ctx.fillRect(mapWidth / 2, mapHeight / 2, 10, 10);
};

function empty(ctx) {
    pxs = {};
    drawn = {};
    ctx.clearRect(0, 0, mapWidth, mapHeight);
}

function contains(bbox1, bbox2) {
    var minX = bbox1[0],
        minY = bbox1[1],
        maxX = bbox1[2],
        maxY = bbox1[3];
    var _minX = bbox2[0],
        _minY = bbox2[1],
        _maxX = bbox2[2],
        _maxY = bbox2[3];

    var inLeft = (_minX >= minX) && (_minX <= maxX);
    var inTop = (_maxY >= minY) && (_maxY <= maxY);
    var inRight = (_maxX >= minX) && (_maxX <= maxX);
    var inBottom = (_minY >= minY) && (_minY <= maxY);

    return (inTop && inLeft && inBottom && inRight);
};

function intersects(bbox1, bbox2)  {
    var minX = bbox1[0],
        minY = bbox1[1],
        maxX = bbox1[2],
        maxY = bbox1[3];
    var _minX = bbox2[0],
        _minY = bbox2[1],
        _maxX = bbox2[2],
        _maxY = bbox2[3];

    var inBottom = (_minY == minY && _maxY == maxY) ? true : (((_minY > minY) && (_minY < maxY)) || ((minY > _minY) && (minY < _maxY)));
    var inTop = (_minY == minY && _maxY == maxY) ? true : (((_maxY > minY) && (_maxY < maxY)) || ((maxY > _minY) && (maxY < _maxY)));
    var inRight = (_maxX == maxX && _minX == minX) ? true : (((_maxX > minX) && (_maxX < maxX)) || ((maxX > _minX) && (maxX < _maxX)));
    var inLeft = (_maxX == maxX && _minX == minX) ? true : (((_minX > minX) && (_minX < maxX)) || ((minX > _minX) && (minX < _maxX)));

    return (contains(bbox1, bbox2)) || ((inTop || inBottom) && (inLeft || inRight));
};

function lon2tile(lon, zoom) {
    return (lon + 180) / 360 * Math.pow(2, zoom);
}

function lat2tile(lat, zoom) {
    return (1.0 - Math.log(Math.tan(lat * Math.PI / 180) + 1.0 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2.0 * Math.pow(2, zoom);
}

function getTileBounds(x, y, zoom) {
    x = Math.floor(x);
    y = Math.floor(y);

    var n = 1 << zoom;
    var longitudeMin = x / n * 360 - 180;
    var lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    var latitudeMin = lat_rad * 180 / Math.PI;

    var longitudeMax = (x + 1) / n * 360 - 180;
    lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
    var latitudeMax = lat_rad * 180 / Math.PI;

    var p1 = degrees2meters(longitudeMin, latitudeMax);
    var p2 = degrees2meters(longitudeMax, latitudeMin);
    return [
        p1.x, p1.y, p2.x, p2.y
    ];

    // var p1 = pixelsToMeters(x * 256, y * 256, zoom);
    // var p2 = pixelsToMeters((x + 1) * 256, (y + 1) * 256, zoom);

    // return [p1.x, p1.y, p2.x, p2.y];
}

function pixelsToMeters(px, py, zoom) {
    var res = getResolution(zoom)
    var mx = px * res - 20037508.34;
    var my = py * res - 20037508.34;
    return { x: mx, y: my };
};


function spiral(rows, cols, callback) {
    var x = 0,
        y = 0,
        dx = 0,
        dy = -1;
    var t = Math.max(rows, cols);
    var maxI = t * t;
    for (var i = 0; i < maxI; i++) {
        if ((-rows / 2 <= x) && (x <= rows / 2) && (-cols / 2 <= y) && (y <= cols / 2)) {
            callback(x, y);
        }
        if ((x == y) || ((x < 0) && (x == -y)) || ((x > 0) && (x == 1 - y))) {
            t = dx;
            dx = -dy;
            dy = t;
        }
        x += dx;
        y += dy;
    }
};
