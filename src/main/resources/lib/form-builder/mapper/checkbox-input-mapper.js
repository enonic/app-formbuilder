var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');

exports.map = function(inputConfig) {
    /*return InputMapper.map(inputConfig)
      .setCheckedState(inputConfig.data.state)
      .setValue(inputConfig.data.value)
      .setText(inputConfig.data.text);*/
    return InputMapper.map(inputConfig)
        .setCheckedState(inputConfig.input[inputConfig.input._selected].state)
        .setValue(inputConfig.input[inputConfig.input._selected].value)
        .setText(inputConfig.input[inputConfig.input._selected].text);
};
