'use strict';

//require projection.js
//require geometry.js

var featuresIndex = {};
var tiles = {};

var tiler = function(features, options) {
    this.options = options;
    this.preprocess(features);
    this.tiles = tiles;
}

tiler.prototype.preprocess = function(features) {
    var feature, polygon, minX, minY, maxX, maxY, coord, projectedCoord;

    var datasetMinX = Infinity,
        datasetMinY = Infinity,
        datasetMaxX = -Infinity,
        datasetMaxY = -Infinity;

    for (var i = 0, l = features.length; i < l; i++) {
        minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        feature = features[i];

        if (!this.isGeoJSON(feature)) {
            feature = this.asGeoJSON(feature);
            features[i] = feature;
        }

        this.options.callback(feature);

        for (var j = 0, ll = feature.geometry.coordinates[0].length; j < ll; j++) {
            polygon = feature.geometry.coordinates[0][j];

            // feature.geometry.coordinates[0][j] = simplify(polygon, 3);
            for (var k = 0, lll = polygon.length; k < lll; k++) {
                coord = polygon[k];

                projectedCoord = degrees2meters(coord[0], coord[1]);
                coord[0] = projectedCoord.x;
                coord[1] = projectedCoord.y;

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

        featuresIndex[feature.properties.cartodb_id] = feature;
    }

    this.bbox = [datasetMinX, datasetMinY, datasetMaxX, datasetMaxY];
    this.generateTiles(features);
};

tiler.prototype.isGeoJSON = function(feature) {
    return feature && feature.properties && feature.geometry;
};

tiler.prototype.asGeoJSON = function(feature) {
    var f = new twkb.toGeoJSON(new Uint8Array(feature.the_geom)).features[0];
    f.properties = {};

    for (var attr in feature) {
        if (attr != 'the_geom') {
            f.properties[attr] = feature[attr];
        } else {
            f.geometry.coordinates = [f.geometry.coordinates];
        }
    }

    return f;
};

tiler.prototype.generateTiles = function(features) {
    var f, id, t;

    var centerX = (this.bbox[2] + this.bbox[0]) / 2;
    var centerY = (this.bbox[3] + this.bbox[1]) / 2;

    var tile = getCenterTile(this.options.fromZoomLevel, centerX, centerY);

    var stack = new Array();

    var tilesWidth = Math.ceil(this.options.mapWidth / TILE_SIZE) + 1;
    var tilesHeight = Math.ceil(this.options.mapHeight / TILE_SIZE) + 1;

    for (var i = -Math.floor(tilesWidth / 2), l = Math.ceil(tilesWidth / 2); i <= l; i++) {
        for (var j = -Math.floor(tilesHeight / 2), ll = Math.ceil(tilesHeight / 2); j <= ll; j++) {
            var nextTile = {
                x: tile.x + i,
                y: tile.y + j,
                z: tile.z
            };

            t = this.createTile(tiles, nextTile, features);
            if (t) {
                stack.push(t);
            }
        }
    }

    while (stack.length) {
        tile = stack.pop();

        if (!tile.features) {
            continue;
        }

        for (var i = 0, l = 2; i < l; i++) {
            for (var j = 0, ll = 2; j < ll; j++) {
                var nextTile = {
                    x: tile.x * 2 + i,
                    y: tile.y * 2 + j,
                    z: tile.z + 1
                };

                t = this.createTile(tiles, nextTile, tile.features);
                if (t && t.z < this.options.toZoomLevel) {
                    stack.push(t);
                }
            }
        }
    }
};

tiler.prototype.createTile = function(tiles, tile, features) {
    var f, n;
    var id = this.getId(tile);

    if (tiles[id]) {
        return;
    }

    var tileBounds = getTileBounds(tile.x, tile.y, tile.z);

    for (var j = 0, ll = features.length; j < ll; j++) {
        f = features[j];

        if (!f.bbox) {
            f = featuresIndex[features[j]];
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

            tiles[id].features.push(f.properties.cartodb_id);
        }
    }

    return tiles[id];
}

tiler.prototype.getId = function(tile) {
    return tile.z + ',' + tile.x + ',' + tile.y;
};

tiler.prototype.getBbox = function(tile) {
    return this.bbox;
};

tiler.prototype.getTile = function(tile) {
    return tiles[this.getId(tile)];
};

tiler.prototype.getFeature = function(id) {
    return featuresIndex[id];
};
