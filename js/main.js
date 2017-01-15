'use strict';

var baseUrl = "https://rambo-test.carto.com/api/v2/";
var queryTWKB = "select ST_AsTWKB(the_geom) as the_geom, lot, cartodb_id from public.mnmappluto";
var query = "select the_geom, lot, cartodb_id from public.mnmappluto&format=GeoJSON";
var dataUrl = baseUrl + "sql?q=" + queryTWKB;

$(document).ready(function() {
    var theMap = new map('#map', {
        zoomLevel: 12,
        debug: true,
        ratio: 2,
        resolutions: resolutions
    });

    theMap.addLayer(new layer(dataUrl, {
        style: {
            attribute: 'lot',
            levels: 7,
            colors: ['#FFFFCC', '#C7E9B4', '#7FCDBB', '#41B6C4', '#1D91C0', '#225EA8', '#0C2C84']
        },
        cacheData: true
    }));

    theMap.addControl(new pan(map));
    theMap.addControl(new zoom(map));
});