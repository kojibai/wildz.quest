import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseWildzMarketUsdInput} from '../src/features/market/wildz-market-presentation';
import {formatWildsUsdCents} from '../src/features/play/wallet/wilds-wallet-format';

test('a listing price becomes exact cents without floating point conversion or rounding',()=>{
 for(const [input,cents] of [['12','1200'],['12.3','1230'],['12.34','1234'],['.01','1'],[' 0.50 ','50'],['999999999999999999999999.99','99999999999999999999999999']]){
  assert.equal(parseWildzMarketUsdInput(input!),cents);
 }
 assert.equal(formatWildsUsdCents(parseWildzMarketUsdInput('999999999999999999999999.99')!), '$999,999,999,999,999,999,999,999.99');
});

test('invalid or fractional-cent listing prices cannot silently change the review amount',()=>{
 for(const input of ['', '0','0.00','-1','+1','1e3','1.001','0.009','12.','$12.00','1,234.56','01.23','Infinity','NaN','9'.repeat(25)]){
  assert.equal(parseWildzMarketUsdInput(input),null,input);
 }
});
