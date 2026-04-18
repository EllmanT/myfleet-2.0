import React, { useEffect, useMemo, useRef } from "react";
import { Box, CircularProgress, TablePagination } from "@mui/material";
import { DeleteOutline, Search, VisibilityOff } from "@mui/icons-material";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const asMUIParams = (agParams) => ({
  id: agParams.node?.id,
  field: agParams.colDef?.field,
  value: agParams.value,
  row: agParams.data,
});

const mapColumn = (column) => ({
  field: column.field,
  headerName: column.headerName ?? column.field,
  width: column.width,
  flex: column.flex,
  sortable: column.sortable !== false,
  filter: false,
  resizable: true,
  valueGetter: column.valueGetter
    ? (params) => column.valueGetter(asMUIParams(params))
    : undefined,
  valueFormatter: column.valueFormatter
    ? (params) => column.valueFormatter(asMUIParams(params))
    : undefined,
  cellRenderer: column.renderCell
    ? (params) => column.renderCell(asMUIParams(params))
    : undefined,
});

export const DataGrid = ({
  loading = false,
  rows = [],
  columns = [],
  getRowId,
  rowCount = 0,
  rowsPerPageOptions = [25, 50, 100],
  paginationModel,
  onPaginationModelChange,
  onSortModelChange,
  components,
  componentsProps,
}) => {
  const page = paginationModel?.page ?? 0;
  const pageSize = paginationModel?.pageSize ?? rowsPerPageOptions[0] ?? 25;
  const Toolbar = components?.Toolbar;
  const gridRef = useRef(null);

  const columnDefs = useMemo(() => columns.map(mapColumn), [columns]);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const sortState = api.getColumnState().find((c) => !!c.sort);
    if (onSortModelChange) {
      onSortModelChange(
        sortState ? [{ field: sortState.colId, sort: sortState.sort }] : []
      );
    }
  }, [onSortModelChange]);

  return (
    <Box>
      {Toolbar ? <Toolbar {...(componentsProps?.toolbar ?? {})} /> : null}
      <Box position="relative">
        {loading ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.2)",
            }}
          >
            <CircularProgress size={28} />
          </Box>
        ) : null}
        <div className="ag-theme-quartz" style={{ width: "100%", height: "70vh" }}>
          <AgGridReact
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            animateRows
            rowSelection="single"
            suppressCellFocus
            getRowId={
              getRowId
                ? (params) => String(getRowId(params.data))
                : (params) => String(params.data?._id ?? params.data?.id ?? "")
            }
            onSortChanged={() => {
              if (!onSortModelChange) return;
              const sortState = gridRef.current?.api
                ?.getColumnState()
                .find((c) => !!c.sort);
              onSortModelChange(
                sortState
                  ? [{ field: sortState.colId, sort: sortState.sort }]
                  : []
              );
            }}
          />
        </div>
      </Box>
      <TablePagination
        component="div"
        count={rowCount}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={rowsPerPageOptions}
        onPageChange={(_, nextPage) =>
          onPaginationModelChange?.({ page: nextPage, pageSize })
        }
        onRowsPerPageChange={(event) =>
          onPaginationModelChange?.({
            page: 0,
            pageSize: parseInt(event.target.value, 10),
          })
        }
      />
    </Box>
  );
};

export const GridDeleteIcon = DeleteOutline;
export const GridSearchIcon = Search;
export const GridVisibilityOffIcon = VisibilityOff;
