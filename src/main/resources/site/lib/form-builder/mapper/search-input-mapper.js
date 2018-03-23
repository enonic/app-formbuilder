var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setPlaceholder(inputConfig.data.placeholder)
    .setPattern(inputConfig.data.pattern)
    .setDatalist(_getDatalist(inputConfig.data));
};

function _getDatalist(inputConfig) {
  if (inputConfig.searchTerms !== undefined) {
    var options = inputConfig.searchTerms;
    var datalist = {
      id: (inputConfig.id ? inputConfig.id : inputConfig.name) + "-datalist",
      options: []
    }
    for (var i = 0; i < options.length; i++) {
      datalist.options[i] = {
        label: options[i],
        value: options[i]
      }
    }
    return datalist;
  }
};