import {Component} from '@angular/core';
import {CORE_DIRECTIVES} from '@angular/common';

import {Observable} from 'rxjs/Rx';

import {MD_INPUT_DIRECTIVES} from '@angular2-material/input';
import {MD_ICON_DIRECTIVES} from '@angular2-material/icon';
import {MD_BUTTON_DIRECTIVES} from '@angular2-material/button';
import {MD_TOOLBAR_DIRECTIVES} from '@angular2-material/toolbar';

import {IBasket, BasketTypeAbcdGrouped} from './gfbio-basket.model';
import {BasketResultGroupByDatasetPipe} from './gfbio-basket.pipe';
import {UserService} from '../users/user.service';

import {PangaeaBasketResultComponent, GroupedAbcdBasketResultComponent} from './gfbio-basket-result.component';

@Component({
    selector: 'wave-gfbio-baskets',
    template: `
    <div style="height:100%; min-width:300px;" layout="column">
        <md-toolbar>
          <label>Basket: </label>
            <select [(ngModel)]='selectedBasket' class='toolbar-fill-remaining-space' >
                <option *ngFor='let basket of baskets | async; let first=first' [ngValue]='basket'> 
                    {{basket.timestamp}} - {{basket.query}}
                    </option>
            </select> 
          <span class="toolbar-fill-remaining-space"></span>
          <button md-icon-button aria-label='sync' (click)='relord()'>
            <md-icon>sync</md-icon>
          </button>
        </md-toolbar>
        <md-content flex="grow">
             <template [ngIf]='selectedBasket'>       
                <template ngFor let-result [ngForOf]='selectedBasket.results | waveBasketResultGroupByDatasetPipe' >
                      
                      <template [ngIf]='result.type === _abcdGroupedType'>
                        <wave-grouped-abcd-basket-result [result]='result'></wave-grouped-abcd-basket-result>
                      </template>
                      <template [ngIf]='result.type !== _abcdGroupedType'>
                        <wave-pangaea-basket-result [result]='result'></wave-pangaea-basket-result>
                      </template>
                </template>
             </template>
        </md-content>
    </div>
    `,
    styles: [`
    
    .toolbar-fill-remaining-space {
        flex: 1 1 auto;
    }
    md-list-item {
        cursor: pointer;
    }
    md-list >>> md-subheader {
        color: white;
        background-color: #009688;
        font-weight: bold;
    }
    img {
      padding: 5px 5px 5px 0;
    }
    `],
    pipes: [BasketResultGroupByDatasetPipe],
    directives: [CORE_DIRECTIVES, MD_INPUT_DIRECTIVES, MD_ICON_DIRECTIVES, MD_TOOLBAR_DIRECTIVES, MD_BUTTON_DIRECTIVES,
        PangaeaBasketResultComponent, GroupedAbcdBasketResultComponent],
})

export class GfbioBasketsComponent {

    private baskets: Observable<Array<IBasket>> = Observable.of([]);
    private selectedBasket: IBasket;
    private _abcdGroupedType: BasketTypeAbcdGrouped = 'abcd_grouped';

    constructor(
        private userService: UserService
    ) {
        this.baskets = this.userService.getGfbioBasketStream();
        this.baskets.subscribe(b => {
            if (!this.selectedBasket && !!b && b.length > 0) {
                console.log('init basket', b);
                this.selectedBasket = b[0];
            }
        });
    }

    relord() {
        this.baskets = this.userService.getGfbioBasketStream().retry();
    }
}
