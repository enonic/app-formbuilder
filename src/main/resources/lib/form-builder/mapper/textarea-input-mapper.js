var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
    /*return InputMapper.map(inputConfig)
      .setValue(inputConfig.data.value)
      .setPlaceholder(inputConfig.data.placeholder);*/
    return InputMapper.map(inputConfig)
        .setValue(inputConfig.input[inputConfig.input._selected].value)
        .setPlaceholder(inputConfig.input[inputConfig.input._selected].placeholder);
};
