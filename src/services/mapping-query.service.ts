import {Injectable} from '@angular/core';
import {Http, Response} from '@angular/http';
import {Observable} from 'rxjs/Rx';

import moment from 'moment';

import {ProjectService} from '../project/project.service';

import {Operator} from '../operators/operator.model';
import {Projection} from '../operators/projection.model';
import {ResultTypes} from '../operators/result-type.model';

import Config from '../app/config.model';
import {PlotData} from '../plots/plot.model';

import {GeoJsonFeatureCollection} from '../models/geojson.model';
import {Provenance} from '../provenance/provenance.model';
import {MappingSource} from '../models/mapping-source.model';
import {Unit} from '../operators/unit.model';

type ParametersType = {[index: string]: string | number | boolean};

export interface MappingColorizer {
    interpolation: string;
    breakpoints: Array<[number, string, string]>;
}

/**
 * WFS Output Formats
 */
class WFSOutputFormatCollection {
    private _JSON = new JSONWFSOutputFormat();
    private _CSV = new CSVWFSOutputFormat();
    get JSON(): WFSOutputFormat { return this._JSON; };
    get CSV(): WFSOutputFormat { return this._CSV; };
}

/**
 * Base class for WFS Output Formats
 */
abstract class WFSOutputFormat {
    protected abstract format: string;
    getFormat(): string {
        return this.format;
    }
}

/**
 * JSON Output format
 */
class JSONWFSOutputFormat extends WFSOutputFormat {
    protected format = 'application/json';
}

/**
 * CSV Output format
 */
class CSVWFSOutputFormat extends WFSOutputFormat {
    protected format = 'csv';
}

/**
 * Export WFSOutputFormat as singleton.
 */
// tslint:disable-next-line:variable-name
export const WFSOutputFormats = new WFSOutputFormatCollection();

/**
 * A service that encapsulates MAPPING queries.
 */
@Injectable()
export class MappingQueryService {
    /**
     * Inject the Http-Provider for asynchronous requests.
     */
    constructor(
        private http: Http,
        private projectService: ProjectService
    ) {}

    /**
     * Get a MAPPING url for the plot operator and time.
     * @param operator the operator graph
     * @param time the point in time
     * @returns the query url
     */
    getPlotQueryUrl(operator: Operator, time: moment.Moment): string {
        const parameters: ParametersType = {
            service: 'plot',
            query: operator.toQueryJSON(),
            time: time.toISOString(),
            crs: operator.projection.getCode(),
        };

        if (operator.getSources(ResultTypes.RASTER).size > 0) {
            parameters['height'] = 1024; // magic number
            parameters['width'] = 1024; // magic number
        }

        return Config.MAPPING_URL + '?' +
               Object.keys(parameters).map(key => key + '=' + parameters[key]).join('&');
    }

    /**
     * Retrieve the plot data by querying MAPPING.
     * @param operator the operator graph
     * @param time the point in time
     * @returns a Promise of PlotData
     */
    getPlotData(operator: Operator, time: moment.Moment): Promise<PlotData> {
        return this.http.get(this.getPlotQueryUrl(operator, time))
                        .toPromise()
                        .then(response => response.json());
    }

    /**
     * Create a stream of PlotData that emits data on every time change.
     * @param operator the operator graph
     * @returns an Observable of PlotData
     */
    getPlotDataStream(operator: Operator): Observable<PlotData> {
        // TODO: remove  `fromPromise` when new rxjs version is used
        // TODO: use flatMapLatest
        return this.projectService.getTimeStream().map(
            time => Observable.fromPromise(this.getPlotData(operator, time))
        ).switch();
    }

    /**
     * Get a MAPPING url for the WFS request.
     * @param operator the operator graph
     * @param time the point in time
     * @param projection the desired projection
     * @param outputFormat the output format
     * @returns the query url
     */
    getWFSQueryUrl(operator: Operator,
                   time: moment.Moment,
                   projection: Projection,
                   outputFormat: WFSOutputFormat): string {
        const projectedOperator = operator.getProjectedOperator(projection);

        const parameters: ParametersType = {
            service: 'WFS',
            version: Config.WFS.VERSION,
            request: 'GetFeature',
            typeNames: projectedOperator.resultType.getCode()
                       + ':'
                       + projectedOperator.toQueryJSON(),
            srsname: projection.getCode(),
            time: time.toISOString(),
            outputFormat: outputFormat.getFormat(),
        };

        return Config.MAPPING_URL + '?' +
               Object.keys(parameters).map(key => key + '=' + parameters[key]).join('&');
    }

    /**
     * Retrieve the WFS data by querying MAPPING.
     * @param operator the operator graph
     * @param time the point in time
     * @param projection the desired projection
     * @param outputFormat the output format
     * @returns a Promise of features
     */
    getWFSData(operator: Operator,
               time: moment.Moment,
               projection: Projection,
               outputFormat: WFSOutputFormat): Promise<string> {
        return this.http.get(this.getWFSQueryUrl(operator, time, projection, outputFormat))
                        .toPromise()
                        .then(response => response.text());
    }

    /**
     * Retrieve the WFS data as JSON by querying MAPPING.
     * @param operator the operator graph
     * @param time the point in time
     * @param projection the desired projection
     * @param outputFormat the output format
     * @returns a Promise of JSON
     */
    getWFSDataAsJson(operator: Operator,
                     time: moment.Moment,
                     projection: Projection): Promise<GeoJsonFeatureCollection> {
        return this.http.get(this.getWFSQueryUrl(operator, time, projection, WFSOutputFormats.JSON))
                        .toPromise()
                        .then(response => response.json());
    }

    /**
     * Create a stream of WFS data that emits data on every time change.
     * @param operator the operator graph
     * @param outputFormat the output format
     * @returns an Observable of features
     */
    getWFSDataStream(operator: Operator, outputFormat: WFSOutputFormat): Observable<string> {
        // TODO: remove  `fromPromise` when new rxjs version is used
        // TODO: use flatMapLatest
        return Observable.combineLatest(
            this.projectService.getTimeStream(), this.projectService.getProjectionStream()
        ).map(([time, projection]) => {
            return Observable.fromPromise(
                this.getWFSData(operator, time, projection, outputFormat)
            );
        }).switch();
    }

    getWFSDataStreamAsGeoJsonFeatureCollection(
        operator: Operator
    ): Observable<GeoJsonFeatureCollection> {
        return Observable.combineLatest(
            this.projectService.getTimeStream(), this.projectService.getProjectionStream()
        ).map(([time, projection]) => {
            return Observable.fromPromise(
                this.getWFSDataAsJson(operator, time, projection)
            );
        }).switch().map(result => {
            const geojson = result as GeoJsonFeatureCollection;
            const features = geojson.features;
            for ( let localRowId = 0 ; localRowId < features.length; localRowId++ ) {
                const feature = features[localRowId];
                if (feature.id === undefined) {
                    feature.id = 'lrid_' + localRowId;
                }
            }
            return geojson;
        }).publishReplay(1).refCount(); // use publishReplay to avoid re-requesting
    }

    /**
     * Get MAPPING query parameters for the WMS request.
     * @param operator the operator graph
     * @param time the point in time
     * @param projection the desired projection
     * @returns the query parameters
     */
    getWMSQueryParameters(operator: Operator,
                          time: moment.Moment,
                          projection: Projection): ParametersType {
        const projectedOperator = operator.getProjectedOperator(projection);

        return {
            service: 'WMS',
            version: Config.WMS.VERSION,
            request: 'GetMap',
            format: Config.WMS.FORMAT,
            transparent: true,
            layers: projectedOperator.toQueryJSON(),
            debug: (Config.DEBUG_MODE ? 1 : 0),
            time: time.toISOString(),
        };
    }

    /**
     * Get a MAPPING url for the WMS request.
     * @param operator the operator graph
     * @param time the point in time
     * @param projection the desired projection
     * @returns the query url
     */
    getWMSQueryUrl(operator: Operator,
                   time: moment.Moment,
                   projection: Projection): string {
        const parameters: ParametersType = this.getWMSQueryParameters(operator, time, projection);

        return Config.MAPPING_URL + '?' +
               Object.keys(parameters).map(key => key + '=' + parameters[key]).join('&');
    }

    getColorizer(operator: Operator,
                 time: moment.Moment,
                 projection: Projection): Promise<MappingColorizer> {

        const projectedOperator = operator.getProjectedOperator(projection);
        const requestType = 'GetColorizer';
        const colorizerRequest = Config.MAPPING_URL
            + '?' + 'SERVICE=WMS'
            + '&' + 'VERSION=' + Config.WMS.VERSION
            + '&' + 'REQUEST=' + requestType
            + '&' + 'LAYERS=' + projectedOperator.toQueryJSON()
            + '&' + 'CRS=' + projection.getCode()
            + '&' + 'TIME=' + time.toISOString(); // TODO: observable-isieren
        // console.log('colorizerRequest', colorizerRequest);
        return this.http.get(colorizerRequest)
            .map((res: Response) => res.json())
            .map((json: MappingColorizer) => { return json; }).toPromise();
    }

    getColorizerStream(operator: Operator): Observable<MappingColorizer> {
        return Observable.combineLatest(
            this.projectService.getTimeStream(), this.projectService.getProjectionStream()
        ).map(([time, projection]) => {
            return Observable.fromPromise(
                this.getColorizer(operator, time, projection)
            );
        }).switch().publishReplay(1).refCount();
    }

    getProvenance(operator: Operator
                    // time: moment.Moment,
                    // projection: Projection
                ): Promise<Provenance> {

        // const projectedOperator = operator.getProjectedOperator(projection);
        const serviceType = 'provenance';
        const provenanceRequest = Config.MAPPING_URL
            + '?' + 'SERVICE=' + serviceType
            + '&' + 'query=' + operator.toQueryJSON();
            // + '&' + 'CRS=' + projection.getCode()
            // + '&' + 'TIME=' + time.toISOString(); // TODO: observable-isieren
        console.log('getProvenance', provenanceRequest);
        return this.http.get(provenanceRequest)
            .map((res: Response) => res.json())
            .map((json: Provenance) => { return json; }).toPromise();
    }

    getProvenanceStream(operator: Operator): Observable<Provenance> {
        // return Observable.combineLatest(
        //     this.projectService.getTimeStream(), this.projectService.getProjectionStream()
        // ).map(([time, projection]) => {
            return Observable.fromPromise(
                this.getProvenance(operator)
            );
        // }).switch().publishReplay(1).refCount();
    }

    getRasterSourcesStream(): Observable<Array<MappingSource>> {
      return this.http.get('assets/mapping-data-sources.json')
                .map((res: Response) => res.json()).map((json: JSON) => {
        let arr: Array<MappingSource> = [];

        for (let sourceId in json['sourcelist']) {
          let source = json['sourcelist'][sourceId];
          arr.push({
            source: sourceId,
            name: source.name,
            colorizer: source.colorizer,
            coords: source.coords,
            channels: source.channels.map((channel: any, index: number) => {
              channel.id = index;
              channel.name = channel.name || 'Channel #' + index;

              // unit handling
              if (channel.unit !== undefined) {
                channel.unit = Unit.fromMappingDict(channel.unit);
              } else {
                channel.unit = Unit.defaultUnit;
              }

              // transform unit handling
              channel.hasTransform = channel.transform !== undefined;
              if (channel.hasTransform) {
                if (channel.transform.unit !== undefined) {
                    channel.transform.unit = Unit.fromMappingDict(channel.transform.unit);
                } else {
                  channel.transform.unit = Unit.defaultUnit;
                }
              }

              return channel;
          }),
          });
        }
        return arr;
      });
    }
}
