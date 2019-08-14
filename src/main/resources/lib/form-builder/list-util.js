exports.asList = function(listOrObject) {
  return asList(listOrObject);
};

exports.iterateSafely = function(listOrObject, handler) {
  iterateSafely(listOrObject, handler);
};

exports.iterateProperties = function(object, handler) {
  iterateProperties(object, handler);
};

var asList = function(listOrObject) {
  if (Object.prototype.toString.call(listOrObject) === '[object Array]') {
    return listOrObject;
  } else if (Object.prototype.toString.call(listOrObject) === '[object Undefined]') {
    return [];
  } else if (Object.prototype.toString.call(listOrObject) === '[object Object]') {
    return [listOrObject];
  } else {
    return [listOrObject];
  }
};

var iterateSafely = function(listOrObject, handler) {
  var list = asList(listOrObject);
  for (var i = 0; i < list.length; i++) {
    handler(list[i]);
  }
};

var iterateProperties = function(object, handler) {
  for (var property in object) {
    if (object.hasOwnProperty(property)) {
      handler(property);
    }
  }
};