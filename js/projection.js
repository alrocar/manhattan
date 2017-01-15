'use strict';

var TILE_SIZE = 256;
var TO_RADIANS = Math.PI / 180;
var MERCATOR_SIZE = 20037508.34;
var EARTH_RADIUS = 6378137;
var EARTH_RADIUS_L = 2 * Math.PI * EARTH_RADIUS;
var MAX_LON = 180;
var MAX_LAT = 90;
var MAX_ZOOM_LEVEL = 18;

var POWERS_OF_TWO = [

];

var resolutions = [];

precalculatePowersOfTwo();
preCalculateMercatorResolutions(MAX_ZOOM_LEVEL);

function precalculatePowersOfTwo() {
    for (var i = 0; i <= MAX_ZOOM_LEVEL; i++) {
        POWERS_OF_TWO[i] = 1 << i;
    }
};

function preCalculateMercatorResolutions(zoomLevels) {
    var maxResolution = MERCATOR_SIZE * 2 / TILE_SIZE,
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

function getTileBounds(x, y, zoom) {
    x = Math.floor(x);
    y = Math.floor(y);

    var n = POWERS_OF_TWO[zoom];
    var longitudeMin = x / n * 360 - MAX_LON;
    var lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    var latitudeMin = lat_rad * MAX_LON / Math.PI;

    var longitudeMax = (x + 1) / n * 360 - MAX_LON;
    lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
    var latitudeMax = lat_rad * MAX_LON / Math.PI;

    var p1 = degrees2meters(longitudeMin, latitudeMax);
    var p2 = degrees2meters(longitudeMax, latitudeMin);
    return [
        p1.x, p1.y, p2.x, p2.y
    ];
};

function _metersToPixels(mx, my, zoom) {
    var res = EARTH_RADIUS_L / TILE_SIZE / POWERS_OF_TWO[zoom];
    var px = (mx + MERCATOR_SIZE) / res;
    var py = (my + MERCATOR_SIZE) / res;
    return {
        x: px,
        y: py
    };
};

function _metersToTile(mx, my, zoom) {
    var p = _metersToPixels(mx, my, zoom);
    return _pixelsToTile(p.x, p.y, zoom);
};

function degrees2meters(lon, lat) {
    var x = lon * MERCATOR_SIZE / MAX_LON;
    var y = Math.log(Math.tan((MAX_LAT + lat) * Math.PI / 360)) / (Math.PI / MAX_LON);
    y = y * MERCATOR_SIZE / MAX_LON;

    return {
        'x': x,
        'y': y
    };
};

function _pixelsToTile(px, py, zoom) {
    var tx = (px / TILE_SIZE);
    var ty = (py / TILE_SIZE) - 1;

    ty = (POWERS_OF_TWO[zoom] - 1) - ty;

    return {
        x: tx,
        y: ty
    };
};

function getCenterTile(zoom, x, y) {
    return getTile(zoom, x, y);
};

function getTile(zoom, x, y) {
    var p = _metersToTile(x, y, zoom);

    var offsetY = Math.floor((p.y - Math.floor(p.y)) * TILE_SIZE);
    var offsetX = Math.floor((p.x - Math.floor(p.x)) * TILE_SIZE);

    return {
        x: Math.floor(p.x),
        y: Math.floor(p.y),
        offsetX: offsetX,
        offsetY: offsetY,
        z: zoom
    };
};

function toCoordinate(pixel, zoomLevel, mapSize, mapCenter) {
    var deltaX = pixel.x - (mapSize.width2);
    var deltaY = pixel.y - (mapSize.height2)

    var m = {
        x: mapCenter.x + deltaX * resolutions[zoomLevel],
        y: mapCenter.y - deltaY * resolutions[zoomLevel]
    };

    return m;
};

function toPixel(coordinate, minX, maxY, resolution) {
    return {
        x: Math.ceil(1 / resolution * (coordinate.x - minX)),
        y: Math.ceil(1 / resolution * (maxY - coordinate.y))
    }
};


/** NOT USED **/
function pixelsToMeters(px, py, zoom) {
    var res = resolutions[zoom];
    var mx = px * res - MERCATOR_SIZE;
    var my = py * res - MERCATOR_SIZE;
    return { x: mx, y: my };
};

function lon2tile(lon, zoom) {
    return (lon + MAX_LON) / 360 * POWERS_OF_TWO[zoom];
};

function lat2tile(lat, zoom) {
    return (1.0 - Math.log(Math.tan(lat * TO_RADIANS) + 1.0 / Math.cos(lat * TO_RADIANS)) / Math.PI) / 2.0 * POWERS_OF_TWO[zoom];
};

function metersToLatLon(mx, my) {
    var lon = (mx / MERCATOR_SIZE) * MAX_LON;
    var lat = (my / MERCATOR_SIZE) * MAX_LON;

    lat = MAX_LON / Math.PI * (2 * Math.atan(Math.exp(lat * TO_RADIANS)) - Math.PI / 2.0)

    return {
        x: lon,
        y: lat
    };
};