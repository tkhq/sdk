// Generated from ../Token/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@turnkey/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type Token = {
  owner: damlTypes.Party,
}

export declare interface TokenInterface {
  Archive: 
    damlTypes.Choice<Token, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<Token, undefined>>;
}
export declare const Token:
  damlTypes.Template<Token, undefined, '#canton:Token:Token'> &
  damlTypes.ToInterface<Token, never> &
  TokenInterface
