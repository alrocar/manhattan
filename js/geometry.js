'use strict';

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

function calcArea(points) {
    var area = 0;

    for (var i = 0, a, b; i < points.length - 1; i++) {
        a = b || points[i];
        b = points[i + 1];

        area += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(area / 2);
};
