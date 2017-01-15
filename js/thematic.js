'use strict';

var minRange;
var maxRange;

function thematic(options) {
    minRange = Infinity;
    maxRange = -Infinity;

    this.attribute = options.attribute;
    this.levels = options.levels;
    this.colors = options.colors;
    this.strokeAt = options.strokeAt;
};

thematic.prototype.visit = function(feature) {
    if (feature.properties[this.attribute]) {
        if (feature.properties[this.attribute] < minRange) {
            minRange = feature.properties[this.attribute];
        }

        if (feature.properties[this.attribute] > minRange) {
            maxRange = feature.properties[this.attribute];
        }
    }

    this.thematicOffset = (maxRange - minRange) / this.levels;
};

thematic.prototype.getColor = function(feature) {
	var colorIndex = feature.properties[this.attribute] & this.thematicOffset;
	return this.colors[Math.floor(colorIndex)];
};