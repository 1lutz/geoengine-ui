import {Component, OnInit, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import {ProjectService, FeatureSelection, LayerMetadata, VectorLayerMetadata, VectorData} from '@geoengine/core';
import {map, mergeMap} from 'rxjs/operators';
import {DataSelectionService} from '../data-selection.service';
import {combineLatest, Observable, of} from 'rxjs';

@Component({
    selector: 'geoengine-data-point',
    templateUrl: './data-point.component.html',
    styleUrls: ['./data-point.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataPointComponent implements OnInit, OnDestroy {
    readonly tableData$: Observable<Array<{key: string; value: any}>>;

    constructor(private readonly projectService: ProjectService, private readonly dataSelectionService: DataSelectionService) {
        this.tableData$ = this.dataSelectionService.vectorLayer.pipe(
            mergeMap((layer) => {
                if (!layer) {
                    return of([undefined, undefined, undefined] as [FeatureSelection?, VectorData?, LayerMetadata?]);
                }

                return combineLatest([
                    this.projectService.getSelectedFeatureStream(),
                    this.projectService.getLayerDataStream(layer) as Observable<VectorData>,
                    this.projectService.getLayerMetadata(layer),
                ]);
            }),
            map(([feature, featureData, metadata]: [FeatureSelection?, VectorData?, LayerMetadata?]) => {
                if (!feature || !featureData || !metadata) {
                    return [];
                }
                if (metadata.layerType !== 'vector') {
                    return [];
                }

                const table = [];

                const vectorMetadata = metadata as VectorLayerMetadata;
                const filteredData = featureData.data.filter((d) => d['id_'] === feature.feature);

                if (filteredData.length === 0) {
                    return [];
                }
                const filteredData0 = filteredData[0];

                for (const column of vectorMetadata.dataTypes.keys()) {
                    const row = {key: column, value: filteredData0['values_'][column]};
                    table.push(row);
                }

                return table;
            }),
        );
    }

    ngOnInit(): void {}

    ngOnDestroy(): void {}
}
