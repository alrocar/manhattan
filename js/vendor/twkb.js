(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
exports.POINT = 1
exports.LINESTRING = 2
exports.POLYGON = 3
exports.MULTIPOINT = 4
exports.MULTILINESTRING = 5
exports.MULTIPOLYGON = 6
exports.COLLECTION = 7

},{}],2:[function(require,module,exports){
/**
 * Functions to decode a subset of types from protobuf encoding
 * See https://developers.google.com/protocol-buffers/docs/encoding
 */

function ReadVarInt64 (ta_struct) {
  var cursor = ta_struct.cursor
  var nVal = 0
  var nShift = 0
  var nByte

  while (true) {
    nByte = ta_struct.buffer[cursor]
    if ((nByte & 0x80) === 0) {
      cursor++
      ta_struct.cursor = cursor
      return nVal | (nByte << nShift)
    }
    nVal = nVal | (nByte & 0x7f) << nShift
    cursor++
    nShift += 7
  }
}

function ReadVarSInt64 (ta_struct) {
  var nVal = ReadVarInt64(ta_struct)
  return unzigzag(nVal)
}

function unzigzag (nVal) {
  if ((nVal & 1) === 0) {
    return nVal >> 1
  }
  return -(nVal >> 1) - 1
}

exports.ReadVarInt64 = ReadVarInt64
exports.ReadVarSInt64 = ReadVarSInt64
exports.unzigzag = unzigzag

},{}],3:[function(require,module,exports){
var readBuffer = require('./readBuffer')

/**
 * Read TWKB to object representation
 * @param {ArrayBuffer} buffer Binary buffer containing TWKB data
 * @param {number} offset Byte offset to start reading the binary buffer
 * @param {number} limit Stop translation after this many objects
 */
function read (buffer, offset, limit) {
  limit = limit || Number.MAX_VALUE

  var ta_struct = {
    buffer: buffer,
    cursor: offset === undefined ? 0 : offset,
    bufferLength: buffer.byteLength || buffer.length,
    refpoint: new Int32Array(4 /* max dims */)
  }

  var data = []
  var c = 0
  while (ta_struct.cursor < ta_struct.bufferLength && c < limit) {
    var res = readBuffer(ta_struct, limit)
    if (res.length > 0) {
      // single geom type, add type info
      data.push({
        type: ta_struct.type,
        offset: limit < Number.MAX_VALUE ? ta_struct.cursor : undefined,
        bbox: ta_struct.has_bbox ? ta_struct.bbox : undefined,
        coordinates: res
      })
    } else {
      res.bbox = ta_struct.has_bbox ? ta_struct.bbox : undefined
      data.push(res)
    }

    c++
  }

  return data
}

module.exports = read

},{"./readBuffer":4}],4:[function(require,module,exports){
var constants = require('./constants')
var ReadVarInt64 = require('./protobuf').ReadVarInt64
var ReadVarSInt64 = require('./protobuf').ReadVarSInt64
var unzigzag = require('./protobuf').unzigzag

function readBuffer (ta_struct, howMany) {
  var flag
  var has_z = 0
  var has_m = 0

  // geometry type and precision header
  flag = ta_struct.buffer[ta_struct.cursor]
  ta_struct.cursor++

  var precision_xy = unzigzag((flag & 0xF0) >> 4)
  ta_struct.type = flag & 0x0F
  ta_struct.factors = []
  ta_struct.factors[0] = ta_struct.factors[1] = Math.pow(10, precision_xy)

  // Metadata header
  flag = ta_struct.buffer[ta_struct.cursor]
  ta_struct.cursor++

  ta_struct.has_bbox = flag & 0x01
  ta_struct.has_size = (flag & 0x02) >> 1
  ta_struct.has_idlist = (flag & 0x04) >> 2
  ta_struct.is_empty = (flag & 0x10) >> 4
  var extended_dims = (flag & 0x08) >> 3

  // the geometry has Z and/or M coordinates
  if (extended_dims) {
    var extended_dims_flag = ta_struct.buffer[ta_struct.cursor]
    ta_struct.cursor++

    // Strip Z/M presence and precision from ext byte
    has_z = (extended_dims_flag & 0x01)
    has_m = (extended_dims_flag & 0x02) >> 1
    var precision_z = (extended_dims_flag & 0x1C) >> 2
    var precision_m = (extended_dims_flag & 0xE0) >> 5

    // Convert the precision into factor
    if (has_z) {
      ta_struct.factors[2] = Math.pow(10, precision_z)
    }
    if (has_m) {
      ta_struct.factors[2 + has_z] = Math.pow(10, precision_m)
    }
    // store in the struct
    ta_struct.has_z = has_z
    ta_struct.has_m = has_m
  }

  var ndims = 2 + has_z + has_m
  ta_struct.ndims = ndims

  // read the total size in bytes
  // The value is the size in bytes of the remainder of the geometry after the size attribute.
  if (ta_struct.has_size) {
    ta_struct.size = ReadVarInt64(ta_struct)
  }

  if (ta_struct.has_bbox) {
    var bbox = []
    for (var i = 0; i <= ndims - 1; i++) {
      var min = ReadVarSInt64(ta_struct)
      var max = min + ReadVarSInt64(ta_struct)
      bbox[i] = min
      bbox[i + ndims] = max
    }
    ta_struct.bbox = bbox
  }

  return readObjects(ta_struct, howMany)
}

function readObjects (ta_struct, howMany) {
  var type = ta_struct.type

  // TWKB variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension
  for (var i = 0; i < ta_struct.ndims; i++) {
    ta_struct.refpoint[i] = 0
  }

  if (type === constants.POINT) {
    return parse_point(ta_struct)
  } else if (type === constants.LINESTRING) {
    return parse_line(ta_struct)
  } else if (type === constants.POLYGON) {
    return parse_polygon(ta_struct)
  } else if (type === constants.MULTIPOINT) {
    return parse_multi(ta_struct, parse_point)
  } else if (type === constants.MULTILINESTRING) {
    return parse_multi(ta_struct, parse_line)
  } else if (type === constants.MULTIPOLYGON) {
    return parse_multi(ta_struct, parse_polygon)
  } else if (type === constants.COLLECTION) {
    return parse_collection(ta_struct, howMany)
  } else {
    throw new Error('Unknown type: ' + type)
  }
}

function parse_point (ta_struct) {
  return read_pa(ta_struct, 1)
}

function parse_line (ta_struct) {
  var npoints = ReadVarInt64(ta_struct)
  return read_pa(ta_struct, npoints)
}

function parse_polygon (ta_struct) {
  var coordinates = []
  var nrings = ReadVarInt64(ta_struct)
  for (var ring = 0; ring < nrings; ++ring) {
    coordinates[ring] = parse_line(ta_struct)
  }
  return coordinates
}

function parse_multi (ta_struct, parser) {
  var type = ta_struct.type
  var ngeoms = ReadVarInt64(ta_struct)
  var geoms = []
  var IDlist = []
  if (ta_struct.has_idlist) {
    IDlist = readIDlist(ta_struct, ngeoms)
  }
  for (var i = 0; i < ngeoms; i++) {
    var geo = parser(ta_struct)
    geoms.push(geo)
  }
  return {
    type: type,
    ids: IDlist,
    geoms: geoms
  }
}

// TODO: share code with parse_multi
function parse_collection (ta_struct, howMany) {
  var type = ta_struct.type
  var ngeoms = ReadVarInt64(ta_struct)
  var geoms = []
  var IDlist = []
  if (ta_struct.has_idlist) {
    IDlist = readIDlist(ta_struct, ngeoms)
  }
  for (var i = 0; i < ngeoms && i < howMany; i++) {
    var geo = readBuffer(ta_struct)
    geoms.push({
      type: ta_struct.type,
      coordinates: geo
    })
  }
  return {
    type: type,
    ids: IDlist,
    ndims: ta_struct.ndims,
    offset: howMany < Number.MAX_VALUE ? ta_struct.cursor : undefined,
    geoms: geoms
  }
}

function read_pa (ta_struct, npoints) {
  var i, j
  var ndims = ta_struct.ndims
  var factors = ta_struct.factors
  var coords = new Array(npoints * ndims)

  for (i = 0; i < npoints; i++) {
    for (j = 0; j < ndims; j++) {
      ta_struct.refpoint[j] += ReadVarSInt64(ta_struct)
      coords[ndims * i + j] = ta_struct.refpoint[j] / factors[j]
    }
  }

  // calculates the bbox if it hasn't it
  if (ta_struct.include_bbox && !ta_struct.has_bbox) {
    for (i = 0; i < npoints; i++) {
      for (j = 0; j < ndims; j++) {
        var c = coords[j * ndims + i]
        if (c < ta_struct.bbox.min[j]) {
          ta_struct.bbox.min[j] = c
        }
        if (c > ta_struct.bbox.max[j]) {
          ta_struct.bbox.max[j] = c
        }
      }
    }
  }
  return coords
}

function readIDlist (ta_struct, n) {
  var idList = []
  for (var i = 0; i < n; i++) {
    idList.push(ReadVarSInt64(ta_struct))
  }
  return idList
}

module.exports = readBuffer

},{"./constants":1,"./protobuf":2}],5:[function(require,module,exports){
var constants = require('./constants')
var readBuffer = require('./readBuffer')

var typeMap = {}
typeMap[constants.POINT] = 'Point'
typeMap[constants.LINESTRING] = 'LineString'
typeMap[constants.POLYGON] = 'Polygon'

// Create GeoJSON Geometry object from TWKB type and coordinate array
function createGeometry (type, coordinates) {
  return {
    type: typeMap[type],
    coordinates: coordinates
  }
}

// Create GeoJSON Feature object (intended for TWKB multi-types)
function createFeature (type, coordinates, id, ndims) {
  return {
    type: 'Feature',
    id: id,
    geometry: transforms[type](coordinates, ndims)
  }
}

// Create an array of GeoJSON feature objects
function createFeaturesFromMulti (type, geoms, ids, ndims) {
  return geoms.map(function (coordinates, i) {
    return createFeature(type, coordinates, ids ? ids[i] : undefined, ndims)
  })
}

// Create an array of GeoJSON feature objects
function createFeaturesFromCollection (geoms, ids, ndims) {
  return geoms.map(function (g, i) {
    return createFeature(g.type, g.coordinates, ids ? ids[i] : undefined, ndims)
  })
}

// Map TWKB type to correct transformation function from intermediate representation to GeoJSON object
var transforms = {}
transforms[constants.POINT] = function (coordinates, ndims) {
  return createGeometry(constants.POINT, toCoords(coordinates, ndims)[0])
}
transforms[constants.LINESTRING] = function (coordinates, ndims) {
  return createGeometry(constants.LINESTRING, toCoords(coordinates, ndims))
}
transforms[constants.POLYGON] = function (coordinates, ndims) {
  return createGeometry(constants.POLYGON, coordinates.map(function (c) { return toCoords(c, ndims) }))
}
transforms[constants.MULTIPOINT] = function (geoms, ids, ndims) {
  return createFeaturesFromMulti(constants.POINT, geoms, ids, ndims)
}
transforms[constants.MULTILINESTRING] = function (geoms, ids, ndims) {
  return createFeaturesFromMulti(constants.LINESTRING, geoms, ids, ndims)
}
transforms[constants.MULTIPOLYGON] = function (geoms, ids, ndims) {
  return createFeaturesFromMulti(constants.POLYGON, geoms, ids, ndims)
}
transforms[constants.COLLECTION] = function (geoms, ids, ndims) {
  return createFeaturesFromCollection(geoms, ids, ndims)
}

// TWKB flat coordinates to GeoJSON coordinates
function toCoords (coordinates, ndims) {
  var coords = []
  for (var i = 0, len = coordinates.length; i < len; i += ndims) {
    var pos = []
    for (var c = 0; c < ndims; ++c) {
      pos.push(coordinates[i + c])
    }
    coords.push(pos)
  }
  return coords
}

/**
 * Transform TWKB to GeoJSON FeatureCollection
 * @param {ArrayBuffer|Buffer} buffer Binary buffer containing TWKB data
 */
function toGeoJSON (buffer) {
  var ta_struct = {
    buffer: buffer,
    cursor: 0,
    bufferLength: buffer.byteLength || buffer.length,
    refpoint: new Int32Array(4 /* max dims */)
  }

  var features = []
  while (ta_struct.cursor < ta_struct.bufferLength) {
    var res = readBuffer(ta_struct, Number.MAX_VALUE)
    if (res.geoms) {
      features = features.concat(transforms[res.type](res.geoms, res.ids, ta_struct.ndims))
    } else {
      features.push({ type: 'Feature', geometry: transforms[ta_struct.type](res, ta_struct.ndims) })
    }
  }

  return {
    type: 'FeatureCollection',
    features: features
  }
}

module.exports = toGeoJSON

},{"./constants":1,"./readBuffer":4}],6:[function(require,module,exports){
(function (global){
var constants = require('./constants')
var toGeoJSON = require('./toGeoJSON')
var read = require('./read')

var twkb = {
  toGeoJSON: toGeoJSON,
  read: read
}

for (var key in constants) {
  twkb[key] = constants[key]
}

module.exports = twkb

global.twkb = twkb

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./constants":1,"./read":3,"./toGeoJSON":5}]},{},[6]);
