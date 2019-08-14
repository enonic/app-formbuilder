var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');
var LIST_UTIL = require('/lib/form-builder/list-util');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setPlaceholder(_getDefaultColor(inputConfig.data))
    .setValue(_getDefaultColor(inputConfig.data))
    .setDatalist(_getColorOptionsAsDatalist(inputConfig.data));
};

function _getDefaultColor(inputConfig) {
  if (inputConfig.colorList) {
    return _getColorOptions(inputConfig.colorList.hexValues)[0] || "#000000";
  } else {
    return "#000000";
  }
};

function _getColorOptions(colors) {
  return LIST_UTIL.asList(colors);
};

function _getColorOptionsAsDatalist(inputConfig) {
  var colorList = inputConfig.colorList;
  if(colorList !== undefined) {
    var datalist = {
      id: (inputConfig.id ? inputConfig.id : inputConfig.name) + '-datalist',
      options: []
    };
    for (var i = 0; i < colorList.length; i++) {
      datalist.options[i] = {
        label: colorList[i],
        value: colorList[i]
      }
    }
    return datalist;
  }
};
