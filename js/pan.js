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

    var getPos = function(e) {
        return {
            x: e.pageX || e.originalEvent.touches[0].pageX,
            y: e.pageY || e.originalEvent.touches[0].pageY
        };
    };

    canvas.on("mousedown touchstart", function(e) {
        var pos = getPos(e);
        
        panOrigin = {
            x: pos.x * ratio,
            y: pos.y * ratio
        };

        lastPanPosition = {
            x: pos.x * ratio,
            y: pos.y * ratio
        };

        canvas.on("mousemove touchmove", function(e) {
            var pos = getPos(e);

            onMove(pos.x, pos.y);
        });
    }).on("mouseup touchend", function(e) {
        canvas.off("mousemove touchmove");

        var pos = getPos(e);

        onMove(pos.x, pos.y);

        recenter();
    });
};
