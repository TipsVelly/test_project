sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Label",
    "sap/m/Input",
    "sap/base/util/deepClone",
    "sap/base/util/deepEqual",
    "sap/m/MessageBox"
], function(
    Controller,
    Filter,
    FilterOperator,
    Label,
    Input,
    deepClone,
    deepEqual,
    MessageBox
) {
    "use strict";

    return Controller.extend("com.tipsvally.testproject.controller.BaseController", {
        DialogNames: Object.freeze({
            DIALOG_TEMPLATE_01: "DialogTemplate01"
        }),

        ConstantControlIds: Object.freeze({
            SEARCH_FORM: "search_form",
            MAIN_TABLE: "main_table"
        }),

        InputModelTypes: Object.freeze({
            ADD_MODEL: "add_model",
            UPDATE_MODEL: "update_model"
        }),

        deepClone: function(oValue) {
            return deepClone(oValue);
        },

        deepEqual: function(oClone, oSource) {
            return deepEqual(oClone, oSource);
        },

        getEntityType: async function(oModel, sEntitySet) {
            // 엔터티셋의 메타데이터에서 엔터티 타입을 가져오는 함수
            if(oModel.getMetadata().getName() === 'sap.ui.model.odata.v2.ODataModel' || oModel.getMetadata().getName() === 'sap.ui.model.odata.v4.ODataModel') {
                await oModel.metadataLoaded();
            }
            const oMetadata = oModel.getServiceMetadata();
            for(const oSchema of oMetadata.dataServices.schema) {
                if(oSchema.entityContainer) {
                    for (const oContainer of oSchema.entityContainer) {
                        const oEntitySet = oContainer.entitySet.find((oSet) => oSet.name === sEntitySet);
                        if (oEntitySet) {
                            // __entityType 또는 entityType 중 하나가 있으면 반환
                            return oEntitySet.__entityType || oEntitySet.entityType || null;
                        }
                    }
                }
            }
            return null; // 엔터티 타입을 찾지 못한 경우
        },

        getProperty: function(oEntityType, sKey) {
            // 엔터티 타입에서 특정 필드의 데이터 타입을 가져오는 함수
            let result = null;
            if(oEntityType) {
                oEntityType.property.forEach((oProperty) => {
                    if(oProperty.name === sKey) {
                        result = oProperty;
                    }
                });
            }
            return result; // 필드의 데이터 타입을 반환

        },

        createFilters: function(oSearchModelData, oEntityType) {
            // 검색 모델 데이터를 기반으로 필터를 생성하는 함수
            const aFilters = [];
            Object.entries(oSearchModelData).forEach(([key, value]) => {
                const oProperty = this.getProperty(oEntityType, key);
                if(oProperty) {
                    if(oProperty.type === 'Edm.String') {
                        if(value) {
                            aFilters.push(new Filter(key, FilterOperator.Contains, value));
                        }
                    } else if (oProperty.type === 'Edm.DateTimeOffset') {
                        if (value) {
                            // DatePicker에서 받은 값이 "2024-07-01T00:00:00+09:00" 형식일 때, 타임존을 포함한 값으로 처리
                            const sStartDate = value.split("T")[0] + "T00:00:00.000";
                            const sEndDate = value.split("T")[0] + "T23:59:59.999";
                            // 날짜 범위 필터 추가 (타임존을 유지한 상태로 필터 적용)
                            aFilters.push(new Filter({
                                path: key,
                                operator: FilterOperator.BT,  // Between 연산자
                                value1: sStartDate,  // 시작 날짜 (타임존 포함)
                                value2: sEndDate     // 종료 날짜 (타임존 포함)
                            }));
                        }
                    } else {
                        if(value) {
                            var numericValue = Number(value);
                            aFilters.push(new Filter(key, FilterOperator.EQ, numericValue));
                        }
                    }
                }
            });
            return aFilters;

        },
        onOpenInputDialog: async function({isUpdate=false, rowData=null, table=null, dialogName="", odataModel=null, entitysetName="", dialogModel=null}) {
            // 다이로그 호출 함수
            this.oDialog ??= await this.loadFragment({
                name:`com.tipsvally.testproject.view.fragments.${dialogName}`
            });
            this.oDialog.setTitle(isUpdate ? "데이터 수정" : "데이터 등록");
            this._createDialogInputs(isUpdate, table, odataModel, entitysetName);
            const oSubmitButton = this.byId("idSaveButton");
            if(isUpdate) {
                dialogModel.setData(rowData);
                oSubmitButton.setText("Update");
            } else {
                dialogModel.setData({});
                oSubmitButton.setText("Register");
            }
            this.oDialog.open();
        },

        _createDialogInputs: async function(bIsUpdate, oTable, oODataModel, sEntitysetName) {
            // 다이로그 입력 컴포넌트 동적 생성 함수
            const oColumns = oTable.getColumns();
            const oForm = this.byId('dialogForm');
            oForm.removeAllContent();
            const oEntityType = await this.getEntityType(oODataModel, sEntitysetName);
            const aKeyProperties = oEntityType.key.propertyRef.map(oPropertyRef => oPropertyRef.name);
            const aFormFields = [];

            // 테이블 컬럼에서 설정된 필드와 키 프로퍼티 처리
            oColumns.forEach((oColumn) => {
                const sLabel = oColumn.getHeader().getText();
                const sProperty = oColumn.getHeader().getCustomData()[0].getValue();
                const oProperty = this.getProperty(oEntityType, sProperty);
                if (aKeyProperties.includes(sProperty)) {
                    if (bIsUpdate) {
                        aFormFields.unshift({ label: sLabel, property: sProperty, isKey: true, isEditable: false, type: oProperty.type });
                    } else {
                        aFormFields.unshift({ label: sLabel, property: sProperty, isKey: true, isEditable: true, type: oProperty.type });
                    }
                } else {
                    aFormFields.push({ label: sLabel, property: sProperty, isKey: false, isEditable: true, type: oProperty.type });
                }
            });

            // 등록 시에만 테이블 컬럼에 없는 키 프로퍼티 처리
            if (!bIsUpdate) {
                aKeyProperties.forEach((sKeyProperty) => {
                    const bKeyExistsInColumns = oColumns.some((oColumn) => {
                        const sProperty = oColumn.getHeader().getCustomData()[0].getValue();
                        return sProperty === sKeyProperty;
                    });
                    if (!bKeyExistsInColumns) {
                        const oProperty = this.getProperty(oEntityType, sKeyProperty);
                        aFormFields.unshift({ label: sKeyProperty, property: sKeyProperty, isKey: true, isEditable: true, type: oProperty.type });
                    }
                });
            }

            // Form에 동적 필드 추가
            aFormFields.forEach((oField) => {
                oForm.addContent(new Label({ text: oField.label }));
                let oInput;
                if (oField.type === "Edm.DateTime" || oField.type === "Edm.DateTimeOffset") {
                    oInput = new sap.m.DatePicker({
                        value: `{${bIsUpdate ? this.InputModelTypes.UPDATE_MODEL : this.InputModelTypes.ADD_MODEL}>/${oField.property}}`,
                        displayFormat: "yyyy-MM-dd (EEE)",
                        valueFormat: "yyyy-MM-dd'T'HH:mm:ss",
                        enabled: oField.isEditable
                    });
                } else {
                    oInput = new Input({
                        value: `{${bIsUpdate ? this.InputModelTypes.UPDATE_MODEL : this.InputModelTypes.ADD_MODEL}>/${oField.property}}`,
                        enabled: oField.isEditable,
                        type: this.getInputType(oField.type)
                    });
                }
                if (oField.isKey && !bIsUpdate) {
                    oInput.setRequired(true);
                }
                oForm.addContent(oInput);
            });
        },
        getInputType: function(sEdmType) {
            // OData 타입에 따른 Input 타입을 반환하는 함수
            switch (sEdmType) {
                case "Edm.String":
                    return "Text";
                case "Edm.Int32":
                case "Edm.Int64":
                case "Edm.Decimal":
                    return "Number";
                case "Edm.Boolean":
                    return "Checkbox";
                case "Edm.Date":
                case "Edm.DateTime":
                    return "Date";
                default:
                    return "Text"; // 기본값은 텍스트로 설정
            }
        },
        validateInputs: async function(oODataModel, sEntitysetName) {
            // 다이로그 입력 컴포넌트 값 유효성 검사 함수
            const oForm = this.byId('dialogForm');
            const oControls = oForm.getContent();
            const oEntityType = await this.getEntityType(oODataModel, sEntitysetName);
            for (let i = 0; i < oControls.length; i += 2) {
                const oLabel = oControls[i];
                const oInput = oControls[i + 1];
                const sProperty = oInput.getBinding("value").getPath().split("/").pop();
                const oPropertyMetadata = this.getProperty(oEntityType, sProperty);
                const sValue = oInput.getValue().trim();
                if (!sValue) {
                    MessageBox.error(`${oLabel.getText()}을(를) 입력해야 합니다.`);
                    return false;
                }
                if (oPropertyMetadata) {
                    switch (oPropertyMetadata.type) {
                        case "Edm.String":
                            break;
                        case "Edm.Int32":
                        case "Edm.Int64":
                        case "Edm.Decimal":
                            if (isNaN(sValue)) {
                                MessageBox.error(`${oLabel.getText()}은(는) 숫자여야 합니다.`);
                                return false;
                            }
                            break;
                        case "Edm.Boolean":
                            if (sValue !== "true" && sValue !== "false") {
                                MessageBox.error(`${oLabel.getText()}은(는) true 또는 false여야 합니다.`);
                                return false;
                            }
                            break;
                        case "Edm.DateTime":
                        case "Edm.DateTimeOffset":
                            if (!this.isValidDate(sValue)) {
                                MessageBox.error(`${oLabel.getText()}은(는) 유효한 날짜여야 합니다.`);
                                return false;
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
            return true;
        },
        isValidDate: function(sDate) {
            //날짜 형식 검증 함수
            const date = Date.parse(sDate);
            return !isNaN(date);

        },
        isDataChanged: function(oNewData, oOldData) {
            // model 데이터 변경 여부 체크 함수
            return JSON.stringify(oNewData) !== JSON.stringify(oOldData);

        },
        _showDeleteResult: function(iSuccessCount, iErrorCount) {
            // 삭제 결과 메세지 생성 함수
            if (iSuccessCount > 0 && iErrorCount === 0) {
                MessageBox.success(`${iSuccessCount}개의 데이터가 성공적으로 삭제되었습니다.`);
            } else if (iSuccessCount > 0 && iErrorCount > 0) {
                MessageBox.warning(`${iSuccessCount}개의 데이터가 성공적으로 삭제되었지만, ${iErrorCount}개의 데이터 삭제에 실패했습니다.`);
            } else if (iErrorCount > 0) {
                MessageBox.error(`${iErrorCount}개의 데이터 삭제에 실패했습니다.`);
            }
        }
    });
});