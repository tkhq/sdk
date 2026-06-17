// Generated from ../../DA/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type Either<a, b> =
  | { tag: 'Left'; value: a }
  | { tag: 'Right'; value: b }


export declare const Either:
  <a, b>(a: damlTypes.Serializable<a>, b: damlTypes.Serializable<b>) => damlTypes.Serializable<Either<a, b>>

export declare type Tuple10<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
}

export declare const Tuple10:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>) => damlTypes.Serializable<Tuple10<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10>>

export declare type Tuple11<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
}

export declare const Tuple11:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>) => damlTypes.Serializable<Tuple11<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11>>

export declare type Tuple12<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
}

export declare const Tuple12:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>) => damlTypes.Serializable<Tuple12<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12>>

export declare type Tuple13<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
}

export declare const Tuple13:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>) => damlTypes.Serializable<Tuple13<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13>>

export declare type Tuple14<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
}

export declare const Tuple14:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>) => damlTypes.Serializable<Tuple14<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14>>

export declare type Tuple15<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
  _15: t15,
}

export declare const Tuple15:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>, t15: damlTypes.Serializable<t15>) => damlTypes.Serializable<Tuple15<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15>>

export declare type Tuple16<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
  _15: t15,
  _16: t16,
}

export declare const Tuple16:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>, t15: damlTypes.Serializable<t15>, t16: damlTypes.Serializable<t16>) => damlTypes.Serializable<Tuple16<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16>>

export declare type Tuple17<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
  _15: t15,
  _16: t16,
  _17: t17,
}

export declare const Tuple17:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>, t15: damlTypes.Serializable<t15>, t16: damlTypes.Serializable<t16>, t17: damlTypes.Serializable<t17>) => damlTypes.Serializable<Tuple17<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17>>

export declare type Tuple18<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
  _15: t15,
  _16: t16,
  _17: t17,
  _18: t18,
}

export declare const Tuple18:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>, t15: damlTypes.Serializable<t15>, t16: damlTypes.Serializable<t16>, t17: damlTypes.Serializable<t17>, t18: damlTypes.Serializable<t18>) => damlTypes.Serializable<Tuple18<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18>>

export declare type Tuple19<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
  _15: t15,
  _16: t16,
  _17: t17,
  _18: t18,
  _19: t19,
}

export declare const Tuple19:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>, t15: damlTypes.Serializable<t15>, t16: damlTypes.Serializable<t16>, t17: damlTypes.Serializable<t17>, t18: damlTypes.Serializable<t18>, t19: damlTypes.Serializable<t19>) => damlTypes.Serializable<Tuple19<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19>>

export declare type Tuple2<t1, t2> = {
  _1: t1,
  _2: t2,
}

export declare const Tuple2:
  <t1, t2>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>) => damlTypes.Serializable<Tuple2<t1, t2>>

export declare type Tuple20<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19, t20> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
  _10: t10,
  _11: t11,
  _12: t12,
  _13: t13,
  _14: t14,
  _15: t15,
  _16: t16,
  _17: t17,
  _18: t18,
  _19: t19,
  _20: t20,
}

export declare const Tuple20:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19, t20>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>, t10: damlTypes.Serializable<t10>, t11: damlTypes.Serializable<t11>, t12: damlTypes.Serializable<t12>, t13: damlTypes.Serializable<t13>, t14: damlTypes.Serializable<t14>, t15: damlTypes.Serializable<t15>, t16: damlTypes.Serializable<t16>, t17: damlTypes.Serializable<t17>, t18: damlTypes.Serializable<t18>, t19: damlTypes.Serializable<t19>, t20: damlTypes.Serializable<t20>) => damlTypes.Serializable<Tuple20<t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, t15, t16, t17, t18, t19, t20>>

export declare type Tuple3<t1, t2, t3> = {
  _1: t1,
  _2: t2,
  _3: t3,
}

export declare const Tuple3:
  <t1, t2, t3>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>) => damlTypes.Serializable<Tuple3<t1, t2, t3>>

export declare type Tuple4<t1, t2, t3, t4> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
}

export declare const Tuple4:
  <t1, t2, t3, t4>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>) => damlTypes.Serializable<Tuple4<t1, t2, t3, t4>>

export declare type Tuple5<t1, t2, t3, t4, t5> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
}

export declare const Tuple5:
  <t1, t2, t3, t4, t5>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>) => damlTypes.Serializable<Tuple5<t1, t2, t3, t4, t5>>

export declare type Tuple6<t1, t2, t3, t4, t5, t6> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
}

export declare const Tuple6:
  <t1, t2, t3, t4, t5, t6>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>) => damlTypes.Serializable<Tuple6<t1, t2, t3, t4, t5, t6>>

export declare type Tuple7<t1, t2, t3, t4, t5, t6, t7> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
}

export declare const Tuple7:
  <t1, t2, t3, t4, t5, t6, t7>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>) => damlTypes.Serializable<Tuple7<t1, t2, t3, t4, t5, t6, t7>>

export declare type Tuple8<t1, t2, t3, t4, t5, t6, t7, t8> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
}

export declare const Tuple8:
  <t1, t2, t3, t4, t5, t6, t7, t8>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>) => damlTypes.Serializable<Tuple8<t1, t2, t3, t4, t5, t6, t7, t8>>

export declare type Tuple9<t1, t2, t3, t4, t5, t6, t7, t8, t9> = {
  _1: t1,
  _2: t2,
  _3: t3,
  _4: t4,
  _5: t5,
  _6: t6,
  _7: t7,
  _8: t8,
  _9: t9,
}

export declare const Tuple9:
  <t1, t2, t3, t4, t5, t6, t7, t8, t9>(t1: damlTypes.Serializable<t1>, t2: damlTypes.Serializable<t2>, t3: damlTypes.Serializable<t3>, t4: damlTypes.Serializable<t4>, t5: damlTypes.Serializable<t5>, t6: damlTypes.Serializable<t6>, t7: damlTypes.Serializable<t7>, t8: damlTypes.Serializable<t8>, t9: damlTypes.Serializable<t9>) => damlTypes.Serializable<Tuple9<t1, t2, t3, t4, t5, t6, t7, t8, t9>>
