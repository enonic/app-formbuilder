var Input = require('/lib/form-builder/model/input').Input;

exports.map = function(inputConfig) {
  return Input(_getFormattedName(inputConfig.data, inputConfig._name), _getInputType(inputConfig), inputConfig.data.label)
    .setXpId(inputConfig._id)
    .setTitle(inputConfig.data.title)
    .setHelpText(inputConfig.data.help)
    .setClassAttribute(_getClassAttribute(inputConfig.data))
    .setRequired(inputConfig.data.required);
};

function _getFormattedName(inputConfig, backupName) {
  var name = (inputConfig.name) ? inputConfig.name : backupName;
  var periodsSpacesDashes = /[\.\s-]+/g;
  return name.replace(periodsSpacesDashes, '_');
}

function _getClassAttribute(inputConfig) {
  return (inputConfig.class) ? inputConfig.class.trim() + " xp-input" : "xp-input";
};

function _getInputType(inputConfig) {
  return (inputConfig.type) ? inputConfig.type.split(":input-")[1] : "text"; // default: text
};
