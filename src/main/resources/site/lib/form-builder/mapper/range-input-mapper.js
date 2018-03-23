var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');
var LIST_UTIL = require('/lib/form-builder/list-util');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setMinimumValue(inputConfig.data.min)
    .setMaximumValue(inputConfig.data.max)
    .setValue(inputConfig.data.valOutput)
    .setStepInterval(inputConfig.data.step)
    .setOutput(inputConfig.data.name + "_output")
    .setDatalist(_getDatalist(inputConfig.data, this.id)); // Does this work?
};

function _getDatalist(inputConfig, id) {
  var datalist;
  var ticks = LIST_UTIL.asList(inputConfig.ticks);
  if (ticks.length > 0) { // Prefer ticks as values
    datalist = {
      id: id,
      options: []
    };
    for (var i = 0; i < ticks.length; i++) {
      datalist.options[i] = {
        label: ticks[i],
        value: ticks[i]
      };
    };
  } else if (inputConfig.min !== undefined && inputConfig.max !== undefined && inputConfig.step !== undefined) { // Fall back to generate datalist based on max, min and step
    datalist = {
      id: id,
      options: []
    };
    for (var i = inputConfig.min; i <= inputConfig.max; i = i + inputConfig.step) {
      datalist.options.push({
        label: i,
        value: i,
        selected: i === inputConfig.value ? true : undefined
      });
    }
  }
  return datalist;
};