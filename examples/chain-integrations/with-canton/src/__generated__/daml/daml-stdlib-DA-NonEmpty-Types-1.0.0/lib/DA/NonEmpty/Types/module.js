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

exports.NonEmpty = function (a) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        hd: a.decoder,
        tl: damlTypes.List(a).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        hd: a.encode(__typed__.hd),
        tl: damlTypes.List(a).encode(__typed__.tl),
      };
    },
  });
};
