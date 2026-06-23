// Generated from ../../../DA/Monoid/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type All = {
  getAll: boolean,
}

export declare const All:
  damlTypes.Serializable<All>

export declare type Any = {
  getAny: boolean,
}

export declare const Any:
  damlTypes.Serializable<Any>

export declare type Product<a> = {
  unpack: a,
}

export declare const Product:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<Product<a>>

export declare type Sum<a> = {
  unpack: a,
}

export declare const Sum:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<Sum<a>>
