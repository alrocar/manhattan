'use strict';
//require tiler.js
//require thematic.js

var drawn = {};

function layer(url, options) {
    this.url = url;

    this.style = new thematic(options.style);
};

layer.prototype.load = function(map, callback) {
    var self = this;
    this.map = map;
    $.getJSON(dataUrl, function(data) {
        self.process(data);
        callback && callback();
    });
};

layer.prototype.process = function(data) {
	var self = this;
    if (!data) {
        throw new Error('Unable to load data');
    }

    this.tileProcessor = new tiler(data.features, {
        fromZoomLevel: 12,
        toZoomLevel: 16,
        callback: function(feature) {
            self.style.visit(feature);
        },
        mapWidth: this.map.mapWidth,
        mapHeight: this.map.mapHeight
    });

    var bbox = this.tileProcessor.getBbox();
    this.map.draw();
};

layer.prototype.getBbox = function() {
	return this.tileProcessor.getBbox();
};

layer.prototype.draw = function() {
    var currentResolution = this.map.getResolution();
    var minX = (this.map.mapCenter.x - (this.map.mapSize.width2 * currentResolution));
    var maxX = (this.map.mapCenter.x + (this.map.mapSize.width2 * currentResolution));
    var minY = (this.map.mapCenter.y - (this.map.mapSize.height2 * currentResolution));
    var maxY = (this.map.mapCenter.y + (this.map.mapSize.height2 * currentResolution));

    var totalPixels = 0,
        tt = 0,
        totalFeatures = 0,
        area = 0,
        fromCache = 0,
        totalDrawn = 0,
        feature;

    this.ctx = this.map.ctx;

    if (map.debug) {
        console.time('draw');
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.map.mapWidth, this.map.mapHeight);
        this.ctx.stroke();
    }

    var tile = getCenterTile(this.map.zoomLevel, this.map.mapCenter.x, this.map.mapCenter.y);

    for (var x = -Math.floor(this.map.tilesWidth / 2), tl = Math.ceil(this.map.tilesWidth / 2); x <= tl; x++) {
        for (var y = -Math.floor(this.map.tilesHeight / 2), tll = Math.ceil(this.map.tilesHeight / 2); y <= tll; y++) {
            var t = this.tileProcessor.getTile({
                x: tile.x + x,
                y: tile.y + y,
                z: tile.z
            });

            if (!t) {
                continue;
            }

            var tileOffsetX = (this.map.mapSize.width2) - tile.offsetX + (TILE_SIZE * x);
            var tileOffsetY = (this.map.mapSize.height2) - tile.offsetY + (TILE_SIZE * y);

            if (t.imageData && t.imageData.data.length) {
                this.ctx.putImageData(t.imageData, tileOffsetX * this.map.ratio, tileOffsetY * this.map.ratio);
                fromCache++;
                continue;
            }

            for (var i = 0, l = t.features.length; i < l; i++) {
                feature = this.tileProcessor.getFeature(t.features[i]);

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

                var color = this.style.getColor(feature);
                var polygon, coord, pixel;
                var lastPixel;

                for (var j = 0, ll = feature.geometry.coordinates[0].length; j < ll; j++) {
                    polygon = feature.geometry.coordinates[0][j];
                    this.ctx.fillStyle = color;
                    lastPixel = null;
                    this.ctx.beginPath();
                    for (var k = 0, lll = polygon.length; k < lll; k++) {
                        coord = polygon[k];

                        pixel = toPixel({
                            x: coord[0],
                            y: coord[1]
                        }, minX, maxY, this.map.getResolution());

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

                        if (!k) {
                            this.ctx.moveTo(pixel.x, pixel.y);
                        } else {
                            this.ctx.lineTo(pixel.x, pixel.y);
                        }
                    }

                    this.ctx.fill();
                }
            }

            if (contains([0, 0, this.map.mapWidth, this.map.mapHeight], [tileOffsetX, tileOffsetY, tileOffsetX + TILE_SIZE, tileOffsetY + TILE_SIZE])) {
                t.imageData = this.ctx.getImageData(tileOffsetX * this.map.ratio, tileOffsetY * this.map.ratio, TILE_SIZE * this.map.ratio, TILE_SIZE * this.map.ratio);
                localStorage.setItem(this.map.zoomLevel + ',' + (tile.x + x) + ',' + (tile.y + y), t.imageData);
            }
        }
    }

    if (this.map.debug) {
        console.timeEnd('draw');

        console.log('totalPixels: ' + totalPixels);
        console.log('simplifications: ' + tt);
        console.log('totalFeatures: ' + totalFeatures);
        console.log('totalArea: ' + area);
        console.log('fromCache: ' + fromCache);
        console.log('drawn: ' + totalDrawn);

        var tile = getCenterTile(this.map.zoomLevel, this.map.mapCenter.x, this.map.mapCenter.y);
        var offsetX = tile.offsetX;
        var offsetY = tile.offsetY;

        for (var i = -Math.floor(this.map.tilesWidth / 2), l = Math.ceil(this.map.tilesWidth / 2); i <= l; i++) {
            for (var j = -Math.floor(this.map.tilesHeight / 2), ll = Math.ceil(this.map.tilesHeight / 2); j <= ll; j++) {
                var leftTop = {
                    x: (this.map.mapWidth / 2) - offsetX + (TILE_SIZE * i),
                    y: (this.map.mapHeight / 2) - offsetY + (TILE_SIZE * j)
                };

                this.ctx.beginPath();
                this.ctx.moveTo(leftTop.x, leftTop.y);
                this.ctx.lineTo(leftTop.x + TILE_SIZE, leftTop.y);
                this.ctx.lineTo(leftTop.x + TILE_SIZE, leftTop.y + TILE_SIZE);
                this.ctx.lineTo(leftTop.x, leftTop.y + TILE_SIZE);
                this.ctx.lineTo(leftTop.x, leftTop.y);
                this.ctx.stroke();

                this.ctx.fillStyle = '#000000';
                this.ctx.fillText((tile.z) + ',' + (tile.x + i) + ',' + (tile.y + j), leftTop.x + 50, leftTop.y + 50);
                this.ctx.fillText((tile.offsetX + TILE_SIZE * i) + ',' + (tile.offsetY + TILE_SIZE * j), leftTop.x + 50, leftTop.y + 100);
            }
        }

        this.ctx.fillRect(this.map.mapWidth / 2, this.map.mapHeight / 2, 10, 10);
    }
};

layer.prototype.empty = function() {
	drawn = {}
};