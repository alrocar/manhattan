var baseUrl = "https://rambo-test.carto.com/api/v2/";
var query = "select the_geom from public.mnmappluto";
var dataUrl = baseUrl + "sql?format=GeoJSON&q=" + query;

var resolutions = [];
var MAX_ZOOM_LEVEL = 18;

var mapCenter = {
    x: -73.964767,
    y: 40.781841
};

var zoomLevel = 12;
var thematicAttribute = 'lot';
var thematicLevels = 7;
var thematicOffset;
var colorRamp = ['#FFFFCC', '#C7E9B4', '#7FCDBB', '#41B6C4', '#1D91C0', '#225EA8', '#0C2C84'];

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

$(document).ready(function() {
    calculateResolutions(MAX_ZOOM_LEVEL);


    // $.getJSON(dataUrl, function(data) {
        // dataset = data;
        var canvas = $('#map');
        canvas.attr({ width: canvas.width(), height: canvas.height() })

        mapWidth = canvas.width();
        mapHeight = canvas.height();

        var ctx = canvas[0].getContext('2d');
        mapCenter = degrees2meters(mapCenter.x, mapCenter.y);

        canvas.on('click', function(e) {
            zoomLevel++;
            mapCenter = toCoordinate({x: e.pageX, y: e.pageY});
            draw(ctx, mapCenter);
        });

        canvas.on('contextmenu', function(e) {
            zoomLevel--;
            mapCenter = toCoordinate({x: e.pageX, y: e.pageY});
            draw(ctx, mapCenter);
        });

        canvas.on("mousedown", function(e) {
            canvas.on("mousemove", function(e) {
                // console.log(e.pageY + ',' + e.pageX);
                // var newMapCenter = toCoordinate({x: e.pageX, y: e.pageY});
                // draw(ctx, newMapCenter);
            });
        }).on("mouseup", function(e) {
            // mapCenter = toCoordinate({x: e.pageX, y: e.pageY});
            // draw(ctx, mapCenter);
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

    // ctx.fillStyle = "rgb(200,0,0)";
    for (var i = 0, l = dataset.features.length; i < l; i++) {
    	console.log(i);
        feature = dataset.features[i];

        //       ctx.beginPath();
        // ctx.moveTo(10,50);
        // ctx.lineTo(100,75);
        // ctx.lineTo(100,25);
        // ctx.fill();

        var colorIndex = feature.properties[thematicAttribute] / thematicOffset + 1;
        var color = colorRamp[Math.floor(colorIndex)];
        var polygon, coord, pixel;
        for (var j = 0, ll = feature.geometry.coordinates[0].length; j < ll; j++) {
            polygon = feature.geometry.coordinates[0][j];
            ctx.fillStyle = color;
            ctx.beginPath();
            for (var k = 0, lll = polygon.length; k < lll; k++) {
                coord = polygon[k];

                // console.log('map: ' + coord[0] + ',' + coord[1]);
                coord = degrees2meters(coord[0], coord[1]);
                pixel = toPixel({
                    x: coord.x,
                    y: coord.y
                }, minX, maxY);

                // console.log(pixel.x + ',' + pixel.y);

                if (k == 0) {
                    ctx.moveTo(pixel.x, pixel.y);
                } else {
                    ctx.lineTo(pixel.x, pixel.y);
                }

                if (k == lll - 1) {
                    ctx.fill();
                }
            }
        }
    }
};

function empty(ctx) {
    ctx.clearRect(0, 0, mapWidth, mapHeight);
}
