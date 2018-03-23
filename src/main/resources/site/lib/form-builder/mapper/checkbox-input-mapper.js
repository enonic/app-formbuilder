var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setCheckedState(inputConfig.data.state)
    .setValue(inputConfig.data.value)
    .setText(inputConfig.data.text);
};