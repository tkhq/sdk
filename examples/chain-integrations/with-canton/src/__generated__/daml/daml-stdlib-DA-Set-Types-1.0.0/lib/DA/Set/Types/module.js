"use strict";
/* eslint-disable-next-line no-unused-vars */
function __export(m) {
/* eslint-disable-next-line no-prototype-builtins */
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });

/* eslint-disable-next-line no-unused-vars */
var jtv = require('@mojotech/json-type-validation');
/* eslint-disable-next-line no-unused-vars */
var damlTypes = require('@daml/types');

exports.Set = function (k) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        map: damlTypes.Map(k, damlTypes.Unit).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        map: damlTypes.Map(k, damlTypes.Unit).encode(__typed__.map),
      };
    },
  });
};
