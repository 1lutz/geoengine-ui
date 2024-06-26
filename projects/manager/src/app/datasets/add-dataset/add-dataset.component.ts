import {Component, ViewChild} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ConfirmationComponent, DatasetsService, errorToText} from '@geoengine/common';
import {DataPath} from '@geoengine/openapi-client';
import {LoadingInfoComponent} from '../loading-info/loading-info.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {filter, firstValueFrom, merge} from 'rxjs';

enum SourceOperators {
    GdalSource,
    OgrSource,
}

enum DataPaths {
    Upload,
    Volume,
}

export interface AddDatasetForm {
    name: FormControl<string>;
    displayName: FormControl<string>;
    sourceOperator: FormControl<SourceOperators>;
    dataPathType: FormControl<DataPaths>;
    dataPath: FormControl<string>;
}

@Component({
    selector: 'geoengine-manager-add-dataset',
    templateUrl: './add-dataset.component.html',
    styleUrl: './add-dataset.component.scss',
})
export class AddDatasetComponent {
    DataPaths = DataPaths;
    SourceOperators = SourceOperators;

    @ViewChild(LoadingInfoComponent) loadingInfoComponent!: LoadingInfoComponent;

    form: FormGroup<AddDatasetForm> = new FormGroup<AddDatasetForm>({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.pattern(/^[a-zA-Z0-9_]+$/), Validators.minLength(3)],
        }),
        displayName: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        sourceOperator: new FormControl(SourceOperators.GdalSource, {
            nonNullable: true,
            validators: [Validators.required],
        }),
        dataPathType: new FormControl(DataPaths.Upload, {
            nonNullable: true,
            validators: [Validators.required],
        }),
        dataPath: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
    });

    constructor(
        private readonly datasetsService: DatasetsService,
        private readonly snackBar: MatSnackBar,
        private readonly dialogRef: MatDialogRef<AddDatasetComponent>,
        private readonly dialog: MatDialog,
    ) {
        merge(this.dialogRef.backdropClick(), this.dialogRef.keydownEvents().pipe(filter((event) => event.key === 'Escape'))).subscribe(
            async (event) => {
                event.stopPropagation();

                if (this.form.pristine && this.loadingInfoComponent.loadingInfo === '') {
                    this.dialogRef.close();
                    return;
                }

                const confirmDialogRef = this.dialog.open(ConfirmationComponent, {
                    data: {message: 'Do you really want to stop creating the dataset? All changes will be lost.'},
                });

                const confirm = await firstValueFrom(confirmDialogRef.afterClosed());

                if (confirm) {
                    this.dialogRef.close();
                }
            },
        );
    }

    async createDataset(): Promise<void> {
        if (!this.form.valid) {
            return;
        }

        const metaData = this.loadingInfoComponent.getMetadataDefinition();

        if (!metaData) {
            this.snackBar.open('Invalid loading information.', 'Close', {panelClass: ['error-snackbar']});
            return;
        }

        const definition = {
            metaData,
            properties: {
                name: this.form.controls.name.value,
                displayName: this.form.controls.displayName.value,
                description: '',
                sourceOperator: SourceOperators[this.form.controls.sourceOperator.value],
            },
        };

        try {
            const datasetName = await this.datasetsService.createDataset(this.getDataPath(), definition);
            this.dialogRef.close(datasetName);
        } catch (error) {
            const errorMessage = await errorToText(error, 'Creating dataset failed.');
            this.snackBar.open(errorMessage, 'Close', {panelClass: ['error-snackbar']});
        }
    }

    private getDataPath(): DataPath {
        if (this.form.value.dataPathType === DataPaths.Upload) {
            return {
                upload: this.form.value.dataPath ?? '',
            };
        } else {
            return {
                volume: this.form.value.dataPath ?? '',
            };
        }
    }
}
