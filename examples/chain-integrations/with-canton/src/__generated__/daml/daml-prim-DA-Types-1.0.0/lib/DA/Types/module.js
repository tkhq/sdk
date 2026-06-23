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

exports.Either = function (a, b) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.oneOf(
        jtv.object({
          tag: jtv.constant("Left"),
          value: a.decoder,
        }),
        jtv.object({
          tag: jtv.constant("Right"),
          value: b.decoder,
        }),
      );
    }),
    encode: function (__typed__) {
      switch(__typed__.tag) {
        case 'Left': return {tag: __typed__.tag, value: a.encode(__typed__.value)};
        case 'Right': return {tag: __typed__.tag, value: b.encode(__typed__.value)};
        default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type Either';
      }
    },
  });
};

exports.Tuple10 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
      };
    },
  });
};

exports.Tuple11 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
      };
    },
  });
};

exports.Tuple12 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
      };
    },
  });
};

exports.Tuple13 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
      };
    },
  });
};

exports.Tuple14 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
      };
    },
  });
};

exports.Tuple15 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
        _15: t15.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
        _15: t15.encode(__typed__._15),
      };
    },
  });
};

exports.Tuple16 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
        _15: t15.decoder,
        _16: t16.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
        _15: t15.encode(__typed__._15),
        _16: t16.encode(__typed__._16),
      };
    },
  });
};

exports.Tuple17 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
        _15: t15.decoder,
        _16: t16.decoder,
        _17: t17.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
        _15: t15.encode(__typed__._15),
        _16: t16.encode(__typed__._16),
        _17: t17.encode(__typed__._17),
      };
    },
  });
};

exports.Tuple18 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
        _15: t15.decoder,
        _16: t16.decoder,
        _17: t17.decoder,
        _18: t18.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
        _15: t15.encode(__typed__._15),
        _16: t16.encode(__typed__._16),
        _17: t17.encode(__typed__._17),
        _18: t18.encode(__typed__._18),
      };
    },
  });
};

exports.Tuple19 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
        _15: t15.decoder,
        _16: t16.decoder,
        _17: t17.decoder,
        _18: t18.decoder,
        _19: t19.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
        _15: t15.encode(__typed__._15),
        _16: t16.encode(__typed__._16),
        _17: t17.encode(__typed__._17),
        _18: t18.encode(__typed__._18),
        _19: t19.encode(__typed__._19),
      };
    },
  });
};

exports.Tuple2 = function (t1, t2) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
      };
    },
  });
};

exports.Tuple20 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19, t20) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
        _10: t10.decoder,
        _11: t11.decoder,
        _12: t12.decoder,
        _13: t13.decoder,
        _14: t14.decoder,
        _15: t15.decoder,
        _16: t16.decoder,
        _17: t17.decoder,
        _18: t18.decoder,
        _19: t19.decoder,
        _20: t20.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
        _10: t10.encode(__typed__._10),
        _11: t11.encode(__typed__._11),
        _12: t12.encode(__typed__._12),
        _13: t13.encode(__typed__._13),
        _14: t14.encode(__typed__._14),
        _15: t15.encode(__typed__._15),
        _16: t16.encode(__typed__._16),
        _17: t17.encode(__typed__._17),
        _18: t18.encode(__typed__._18),
        _19: t19.encode(__typed__._19),
        _20: t20.encode(__typed__._20),
      };
    },
  });
};

exports.Tuple3 = function (t1, t2, t3) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
      };
    },
  });
};

exports.Tuple4 = function (t1, t2, t3, t4) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
      };
    },
  });
};

exports.Tuple5 = function (t1, t2, t3, t4, t5) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
      };
    },
  });
};

exports.Tuple6 = function (t1, t2, t3, t4, t5, t6) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
      };
    },
  });
};

exports.Tuple7 = function (t1, t2, t3, t4, t5, t6, t7) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
      };
    },
  });
};

exports.Tuple8 = function (t1, t2, t3, t4, t5, t6, t7, t8) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
      };
    },
  });
};

exports.Tuple9 = function (t1, t2, t3, t4, t5, t6, t7, t8, t9) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        _1: t1.decoder,
        _2: t2.decoder,
        _3: t3.decoder,
        _4: t4.decoder,
        _5: t5.decoder,
        _6: t6.decoder,
        _7: t7.decoder,
        _8: t8.decoder,
        _9: t9.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        _1: t1.encode(__typed__._1),
        _2: t2.encode(__typed__._2),
        _3: t3.encode(__typed__._3),
        _4: t4.encode(__typed__._4),
        _5: t5.encode(__typed__._5),
        _6: t6.encode(__typed__._6),
        _7: t7.encode(__typed__._7),
        _8: t8.encode(__typed__._8),
        _9: t9.encode(__typed__._9),
      };
    },
  });
};
