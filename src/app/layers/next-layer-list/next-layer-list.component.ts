import {Component, OnInit, OnDestroy} from '@angular/core';
import {MdDialog} from '@angular/material';
import {LayoutService} from '../../layout.service';
import {Observable, Subscription} from 'rxjs';
import {SymbologyType, Symbology} from '../../../symbology/symbology.model';
import {SymbologyDialogComponent} from '../../../symbology/symbology-dialog.component';
import {RenameLayerComponent} from '../dialogs/rename-layer.component';
import {OperatorGraphDialogComponent} from '../dialogs/operator-graph.component';
import {ExportDialogComponent} from '../dialogs/export.component';
import {OperatorRepositoryComponent} from '../../../components/operator-repository.component';
import {LoadingState} from '../../project/loading-state.model';
import {DragulaService} from 'ng2-dragula';
import {LayerService} from '../../../layers/layer.service';
import {MapService} from '../../../map/map.service';
import {Layer} from '../../../layers/layer.model';

@Component({
  selector: 'wave-next-layer-list',
  templateUrl: './next-layer-list.component.html',
  styleUrls: ['./next-layer-list.component.scss']
})
export class NextLayerListComponent implements OnInit, OnDestroy {

    layerListVisibility$: Observable<boolean>;

    // make visible in template
    // tslint:disable:variable-name
    _enumSymbologyType = SymbologyType;
    LoadingState = LoadingState;
    RenameLayerComponent = RenameLayerComponent;
    SymbologyDialogComponent = SymbologyDialogComponent;
    OperatorGraphDialogComponent = OperatorGraphDialogComponent;
    ExportDialogComponent = ExportDialogComponent;
    OperatorRepositoryComponent = OperatorRepositoryComponent;
    // tslint:enable

    private subscriptions: Array<Subscription> = [];

    constructor(
     public dialog: MdDialog,
     private layoutService: LayoutService,
     private dragulaService: DragulaService,
     private layerService: LayerService,
     private mapService: MapService
    ) {
     this.layerListVisibility$ = this.layoutService.getLayerListVisibilityStream();

      dragulaService.setOptions('layer-bag', {
          removeOnSpill: false,
          revertOnSpill: true,
      });

      this.handleDragAndDrop();
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    handleDragAndDrop() {
        let dragIndex: number;
        let dropIndex: number;

        this.subscriptions.push(
            this.dragulaService.drag.subscribe((value: [string, HTMLElement, HTMLElement]) => {
                const [_, listItem, list] = value;
                dragIndex = NextLayerListComponent.domIndexOf(listItem, list);
                // console.log('drag', dragIndex);
            })
        );
        this.subscriptions.push(
            this.dragulaService.drop.subscribe((value: [string, HTMLElement, HTMLElement]) => {
                const [_, listItem, list] = value;
                dropIndex = NextLayerListComponent.domIndexOf(listItem, list);
                // console.log('drop', dropIndex);

                const layers = this.layerService.getLayers();
                layers.splice(dropIndex, 0, layers.splice(dragIndex, 1)[0]);
                this.layerService.setLayers(layers);
            })
        );
    }

    toggleLayer(layer: Layer<Symbology>) {
        this.layerService.toggleLayer(layer);
    }

    private static domIndexOf(child: HTMLElement, parent: HTMLElement) {
        return Array.prototype.indexOf.call(parent.children, child);
    }
}
