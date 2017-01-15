function map(mapId, options) {
    this.layers = [];
    this.controls = [];

    this.zoomLevel = options.zoomLevel;
    this.debug = options.debug;
    this.maxZoomLevel = options.maxZoomLevel || 16;
    this.minZoomLevel = options.minZoomLevel || 12;
    this.ratio = devicePixelRatio;
    this.resolutions = options.resolutions;

    var canvas = $(mapId);
    this.cv = canvas[0];
    this.canvas = canvas;

    canvas.attr({ width: canvas.width(), height: canvas.height() });

    this.ctx = canvas[0].getContext('2d');

    if (this.ratio > 1) {
        this.cv.style.width = this.cv.width + 'px';
        this.cv.style.height = this.cv.height + 'px';
        this.cv.width *= this.ratio;
        this.cv.height *= this.ratio;
        this.ctx.scale(this.ratio, this.ratio);
    }

    this.mapWidth = canvas.width();
    this.mapHeight = canvas.height();

    this.mapSize = {
        width: this.mapWidth,
        height: this.mapHeight,
        width2: this.mapWidth / 2,
        height2: this.mapHeight / 2
    };

    this.mapCenter = {
        x: 0,
        y: 0
    };

    this.tilesWidth = Math.ceil(this.mapWidth / TILE_SIZE) + 1;
    this.tilesHeight = Math.ceil(this.mapHeight / TILE_SIZE) + 1;
};

map.prototype.getViewportBounds = function() {
    var minX = mapCenter.x - (mapWidth * this.getResolution());
    var maxX = mapCenter.x + (mapWidth * this.getResolution());
    var minY = mapCenter.y - (mapHeight * this.getResolution());
    var maxY = mapCenter.y + (mapHeight * this.getResolution());

    return [minX, minY, maxX, maxY];
};

map.prototype.getResolution = function() {
    return this.resolutions[this.zoomLevel] * this.ratio;
};

map.prototype.addLayer = function(layer) {
    var self = this;
    this.layers.push(layer);
    layer.load(this, function() {
        var bbox = layer.getBbox();

        self.mapCenter.x = (bbox[2] + bbox[0]) / 2;
        self.mapCenter.y = (bbox[3] + bbox[1]) / 2;

        self.draw();
    });
};

map.prototype.addControl = function(control) {
    this.controls.push(control);
    control.load(this);
};

map.prototype.draw = function() {
    this.empty();
    for (var i = 0, l = this.layers.length; i < l; i++) {
        this.layers[i].draw();
    }
};

map.prototype.empty = function() {
    for (var i = 0, l = this.layers.length; i < l; i++) {
        this.layers[i].empty();
    }

    this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);
};

map.prototype.zoomIn = function() {
    this.zoomLevel = Math.min(++this.zoomLevel, this.maxZoomLevel);
    this.draw();
};

map.prototype.zoomOut = function() {
    this.zoomLevel = Math.max(--this.zoomLevel, this.minZoomLevel);
    this.draw();
};