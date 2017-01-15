'use strict';

var panOrigin;
var lastPanPosition;

//require projection.js

function pan() {

};

pan.prototype.load = function(map) {
    this.map = map;

    var canvas = map.canvas;
    var ctx = map.ctx;
    var ratio = map.ratio;
    var mapSize = map.mapSize;

    lastPanPosition = {
        x: mapSize.width2,
        y: mapSize.height2
    };

    var onMove = function(x, y) {
        var translateTo = {
            x: x * ratio - lastPanPosition.x,
            y: y * ratio - lastPanPosition.y
        };

        lastPanPosition = {
            x: x * ratio,
            y: y * ratio
        };

        var imgData = ctx.getImageData(0, 0, mapSize.width * ratio, mapSize.height * ratio);
        map.empty();
        ctx.putImageData(imgData, translateTo.x, translateTo.y);
    };

    var recenter = function() {
        var newCenterPx = mapSize.width2 - (lastPanPosition.x - panOrigin.x);
        var newCenterPy = mapSize.height2 - (lastPanPosition.y - panOrigin.y);

        map.mapCenter = toCoordinate({
            x: newCenterPx,
            y: newCenterPy
        }, map.zoomLevel, mapSize, map.mapCenter);

        map.draw();
    };

    canvas.on("mousedown", function(e) {
        panOrigin = {
            x: e.pageX * ratio,
            y: e.pageY * ratio
        };

        lastPanPosition = {
            x: e.pageX * ratio,
            y: e.pageY * ratio
        };

        canvas.on("mousemove", function(e) {
            onMove(e.pageX, e.pageY);
        });
    }).on("mouseup", function(e) {
        canvas.off("mousemove");

        onMove(e.pageX, e.pageY);

        recenter();
    });
};
