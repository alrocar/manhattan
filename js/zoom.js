'use strict';

function zoom() {

};

zoom.prototype.load = function(map) {
    $('.zoom_in').on('click', function(e) {
        map.zoomIn();
    });

    $('.zoom_out').on('click', function(e) {
        map.zoomOut();
    });
};