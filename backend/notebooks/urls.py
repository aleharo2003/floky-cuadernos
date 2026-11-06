from django.urls import path

from notebooks.views import (
    CashOpeningView,
    CashView,
    CategoryListView,
    EntryDetailView,
    EntryHistoryView,
    EntryListView,
    EntryVoidView,
    ExportView,
    MonthlyView,
    RecentChangesView,
    SettingsView,
    SummaryView,
)

urlpatterns = [
    path("categories/", CategoryListView.as_view()),
    path("entries/", EntryListView.as_view()),
    path("entries/<uuid:entry_id>/", EntryDetailView.as_view()),
    path("entries/<uuid:entry_id>/void/", EntryVoidView.as_view()),
    path("entries/<uuid:entry_id>/history/", EntryHistoryView.as_view()),
    path("changes/", RecentChangesView.as_view()),
    path("summary/", SummaryView.as_view()),
    path("monthly/", MonthlyView.as_view()),
    path("export/", ExportView.as_view()),
    path("cash/", CashView.as_view()),
    path("cash/opening/", CashOpeningView.as_view()),
    path("settings/", SettingsView.as_view()),
]
