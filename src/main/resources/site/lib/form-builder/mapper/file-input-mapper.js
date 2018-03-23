var Input = require('/lib/form-builder/model/input');
var InputMapper = require('/lib/form-builder/mapper/input-mapper');
var LIST_UTIL = require('/lib/form-builder/list-util');

exports.map = function(inputConfig) {
  return InputMapper.map(inputConfig)
    .setAcceptedFileTypes(_getAcceptedFileTypes(inputConfig.data))
    .setSupportsCapture(_isSupportCapture(inputConfig.data))
    .setAllowMultipleFiles(inputConfig.data.multiple);
};

function _getAcceptedFileTypes(inputConfig) {
  if (inputConfig.accept && inputConfig.accept.length !== 0) {
    var acceptedFileTypes = "";
    LIST_UTIL.iterateSafely(inputConfig.accept, function(acceptedFormat) {
      if (acceptedFileTypes !== "") acceptedFileTypes += ";";
      acceptedFileTypes += acceptedFormat;
    });
    return acceptedFileTypes;
  }
};

function _isSupportCapture(inputConfig) {
  var supportsCapture = false;
  LIST_UTIL.iterateSafely(inputConfig.accept, function(acceptedFormat) {
    if (acceptedFormat === 'image/*' || 
        acceptedFormat === 'video/*' || 
        acceptedFormat === 'audio/*') {
      return supportsCapture;
    }
  });
  return supportsCapture;
};