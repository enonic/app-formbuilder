var Input = require('/lib/form-builder/model/input').Input;

exports.map = function(inputConfig) {
  /*
  return Input(_getFormattedName(inputConfig.data, inputConfig._name), _getInputType(inputConfig), inputConfig.displayName)
    .setXpId(inputConfig._id)
    .setTitle(inputConfig.data.title)
    .setHelpText(inputConfig.data.help)
    .setClassAttribute(_getClassAttribute(inputConfig.data))
    .setRequired(inputConfig.data.required);
  */
  return Input(_getFormattedName(inputConfig), _getInputType(inputConfig), inputConfig.label)
    .setXpId(inputConfig._id)
    .setTitle(inputConfig.input._selected ? inputConfig.input[inputConfig.input._selected].title : null)
    .setHelpText(inputConfig.help)
    .setClassAttribute(_getClassAttribute(inputConfig))
    .setRequired(inputConfig.required);
};

function _getFormattedName(inputConfig) {
  /*
  var name = (inputConfig.name) ? inputConfig.name : backupName;
  var periodsSpacesDashes = /[\.\s-]+/g;
  return name.replace(periodsSpacesDashes, '_');
  */
  /*
  var illegalCharacters = /^[a-z0-9_]+/g;
  return name.toLowerCase().replace(illegalCharacters, '_');
  */
  return encodeURIComponent(inputConfig.name || inputConfig.label);
}

function _getClassAttribute(inputConfig) {
  return (inputConfig.class) ? inputConfig.class.trim() + " xp-input" : "xp-input";
};

function _getInputType(inputConfig) {
    //return (inputConfig.type) ? inputConfig.type.split(":input-")[1] : "text"; // default: text
    return (inputConfig.input && inputConfig.input._selected) ? inputConfig.input._selected : "text"; // default: text
};
