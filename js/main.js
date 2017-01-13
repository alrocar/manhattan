var baseUrl = "https://rambo-test.carto.com/api/v2/";
var query = "select the_geom from public.mnmappluto";
var dataUrl = baseUrl + "sql?format=GeoJSON&q=" + query;

var resolutions = [];
var MAX_ZOOM_LEVEL = 18;

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

function preprocess(features) {
	var feature, polygon, minX, minY, maxX, maxY, coord;
	for (var i = 0, l = features.length; i<l; i++) {
		minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		feature = features[i];
		for (var j = 0, ll = feature.geometry.coordinates[0].length; j < ll; j++) {
            polygon = feature.geometry.coordinates[0][j];
            for (var k = 0, lll = polygon.length; k < lll; k++) {
            	coord = polygon[k];
            	minX = Math.min(coord[0], minX);
            	minY = Math.min(coord[1], minY);
            	maxX = Math.max(coord[0], maxX);
            	maxY = Math.max(coord[1], maxY);
            }
            feature.bbox = [minX, minY, maxX, maxY];
        }
	}
};

function calculateResolutions(zoomLevels) {
    // var maxResolution = 20037508 * 2 / 256,
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

function getViewportBounds() {
	var minX = mapCenter.x - (mapWidth * getResolution());
	var maxX = mapCenter.x + (mapWidth * getResolution());
	var minY = mapCenter.y - (mapHeight * getResolution());
	var maxY = mapCenter.y + (mapHeight * getResolution());

	return [minX, minY, maxX, maxY];
};

function getResolution() {
    return resolutions[zoomLevel];
};

function toPixel(coordinate, minX, maxY) {
    var resolution = getResolution();
    return {
        x: Math.ceil(1 / resolution * (coordinate.x - minX)),
        y: Math.ceil(1 / resolution * (maxY - coordinate.y))
    }
};

function toCoordinate(pixel) {
    var deltaX = pixel.x - (mapWidth / 2);
    var deltaY = pixel.y - (mapHeight / 2);

    return {
        x: mapCenter.x + deltaX * getResolution(),
        y: mapCenter.y - deltaY * getResolution()
    };
}

function degrees2meters(lon, lat) {
    // var x = lon * 20037508.34 / 180;
    // var y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    // y = y * 20037508.34 / 180;

    return {
        'x': lon,
        'y': lat
    };
};

var /*dataset,*/ mapWidth, mapHeight;
var lastPanPosition, panOrigin;

$(document).ready(function() {
    calculateResolutions(MAX_ZOOM_LEVEL);

    preprocess(dataset.features);


    // $.getJSON(dataUrl, function(data) {
        // dataset = data;
        var canvas = $('#map');
        canvas.attr({ width: canvas.width(), height: canvas.height() });
        buffer = canvas.clone();

        mapWidth = canvas.width();
        mapHeight = canvas.height();

        lastPanPosition = {
        	x: mapWidth / 2,
        	y: mapHeight / 2
        };

        var ctx = canvas[0].getContext('2d');
        bufferCtx = buffer[0].getContext('2d');
        mapCenter = degrees2meters(mapCenter.x, mapCenter.y);

        $('.zoom_in').on('click', function(e) {
            zoomLevel++;
            // mapCenter = toCoordinate({x: e.pageX, y: e.pageY});
            draw(ctx, mapCenter);
        });

        $('.zoom_out').on('click', function(e) {
            zoomLevel--;
            // mapCenter = toCoordinate({x: e.pageX, y: e.pageY});
            draw(ctx, mapCenter);
        });

        canvas.on("mousedown", function(e) {
        	panOrigin = {
        		x: e.pageX,
        		y: e.pageY
        	};

        	lastPanPosition = {
            	x: e.pageX,
            	y: e.pageY
            };

            canvas.on("mousemove", function(e) {
                // console.log(e.pageY + ',' + e.pageX);
                // var newMapCenter = toCoordinate({x: e.pageX, y: e.pageY});
                // draw(ctx, newMapCenter);
                var translateTo = {
	            	x: e.pageX - lastPanPosition.x,
	            	y: e.pageY - lastPanPosition.y
	            };

	            lastPanPosition = {
	            	x: e.pageX,
	            	y: e.pageY
	            };

	            var imgData=ctx.getImageData(0,0,mapWidth,mapHeight);
	            empty(ctx);
				ctx.putImageData(imgData,translateTo.x,translateTo.y);
            });
        }).on("mouseup", function(e) {
            // mapCenter = toCoordinate({x: e.pageX, y: e.pageY});
            // draw(ctx, mapCenter);
            canvas.off("mousemove");

            var translateTo = {
            	x: e.pageX - lastPanPosition.x,
            	y: e.pageY - lastPanPosition.y
            };

            lastPanPosition = {
            	x: e.pageX,
            	y: e.pageY
            };

            var imgData=ctx.getImageData(0,0,mapWidth,mapHeight);
            empty(ctx);
			ctx.putImageData(imgData,translateTo.x,translateTo.y);

			var newCenterPx = (mapWidth / 2) - (lastPanPosition.x - panOrigin.x);
			var newCenterPy = (mapHeight / 2) - (lastPanPosition.y - panOrigin.y);
			// mapCenter.x -= (lastPanPosition.x - panOrigin.x) * getResolution();
			// mapCenter.y -= (lastPanPosition.y - panOrigin.y) * getResolution();
			mapCenter = toCoordinate({
				x: newCenterPx,
				y: newCenterPy
			});

			draw(ctx, mapCenter);
        });

        prepare(dataset);

        draw(ctx, mapCenter);
    });
// });

function prepare(dataset) {
	var feature;
	var minRange = Number.MAX_VALUE, maxRange = Number.MIN_VALUE;
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
    var totalPixels = 0, tt = 0, totalFeatures = 0;
   	var t1 = new Date().getTime();

   	var viewPortBounds = getViewportBounds();
    for (var i = 0, l = dataset.features.length; i < l; i++) {
    	// console.log(i);
        feature = dataset.features[i];

        if (!intersects(viewPortBounds, feature.bbox)) {
        	continue;
        }

        totalFeatures++;

        var colorIndex = feature.properties[thematicAttribute] / thematicOffset + 1;
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
                coord = degrees2meters(coord[0], coord[1]);
                pixel = toPixel({
                    x: coord.x,
                    y: coord.y
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

                if (!k) {
                    ctx.moveTo(pixel.x, pixel.y);
                } else {
                    ctx.lineTo(pixel.x, pixel.y);
                }

                if (k == lll - 1) {
                    ctx.fill('evenodd');
                }
            }
        }
    }

    console.log('rendering ' + (new Date().getTime() - t1));

    t1 = new Date().getTime();
    // ctx.putImageData(bufferCtx.getImageData(0,0,mapWidth,mapHeight), 0, 0);
	console.log('canvas ' + (new Date().getTime() - t1));

    console.log('totalPixels: ' + totalPixels);
    console.log('simplifications: ' + tt);
    console.log('totalFeatures: ' + totalFeatures);
};

function empty(ctx) {
	pxs = {};
    ctx.clearRect(0, 0, mapWidth, mapHeight);
}

function contains(bbox1, bbox2) {
	var minX = bbox1[0], minY = bbox1[1], maxX = bbox1[2], maxY = bbox1[3];
    var _minX = bbox2[0], _minY = bbox2[1], _maxX = bbox2[2], _maxY = bbox2[3];

	var inLeft = (_minX >= minX)
			&& (_minX <= maxX);
	var inTop = (_maxY >= minY)
			&& (_maxY <= maxY);
	var inRight = (_maxX >= minX)
			&& (_maxX <= maxX);
	var inBottom = (_minY >= minY)
			&& (_minY <= maxY);

	return (inTop && inLeft && inBottom && inRight);
};

function intersects(bbox1, bbox2) {
	var minX = bbox1[0], minY = bbox1[1], maxX = bbox1[2], maxY = bbox1[3];
    var _minX = bbox2[0], _minY = bbox2[1], _maxX = bbox2[2], _maxY = bbox2[3];

	var inBottom = (_minY == minY && _maxY == maxY) ? true
			: (((_minY > minY) && (_minY < maxY)) || ((minY > _minY) && (minY < _maxY)));
	var inTop = (_minY == minY && _maxY == maxY) ? true
			: (((_maxY > minY) && (_maxY < maxY)) || ((maxY > _minY) && (maxY < _maxY)));
	var inRight = (_maxX == maxX && _minX == minX) ? true
			: (((_maxX > minX) && (_maxX < maxX)) || ((maxX > _minX) && (maxX < _maxX)));
	var inLeft = (_maxX == maxX && _minX == minX) ? true
			: (((_minX > minX) && (_minX < maxX)) || ((minX > _minX) && (minX < _maxX)));

	return (contains(bbox1, bbox2)) || ((inTop || inBottom) && (inLeft || inRight));
};