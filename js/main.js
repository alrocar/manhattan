'use strict';

var baseUrl = "https://rambo-test.carto.com/api/v2/";
var query = "select the_geom, lot, cartodb_id from public.mnmappluto";
var dataUrl = baseUrl + "sql?format=GeoJSON&q=" + query;

$(document).ready(function() {
    var theMap = new map('#map', {
        zoomLevel: 12,
        debug: true,
        ratio: devicePixelRatio,
        resolutions: resolutions
    });

    theMap.addLayer(new layer(dataUrl, {
        style: {
            attribute: 'lot',
            levels: 7,
            colors: ['#FFFFCC', '#C7E9B4', '#7FCDBB', '#41B6C4', '#1D91C0', '#225EA8', '#0C2C84']
        }
    }));

    theMap.addControl(new pan(map));
    theMap.addControl(new zoom(map));
});