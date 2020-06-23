var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');
var portalLib = require('/lib/xp/portal');
var illegalBlockElements = new RegExp(/<[/]?(div|p)[^>]*>/gi);

exports.map = function(inputConfig) {
    /*return InputMapper.map(inputConfig)
      .setCheckedState(inputConfig.data.state)
      .setValue(inputConfig.data.value)
      .setText(inputConfig.data.text);*/
    return InputMapper.map(inputConfig)
        .setCheckedState(inputConfig.input[inputConfig.input._selected].state)
        .setValue(inputConfig.input[inputConfig.input._selected].value)
        .setText(inputConfig.input[inputConfig.input._selected].text ?
            portalLib.processHtml({
                value: inputConfig.input[inputConfig.input._selected].text
            }).replace(illegalBlockElements, '') : undefined); // strip away illegal block elements like div and p
};
