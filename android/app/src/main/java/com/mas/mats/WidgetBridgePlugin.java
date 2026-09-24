package com.mas.mats;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            String widgetJson = call.getString("widgetJson");
            if (widgetJson == null) {
                JSObject raw = call.getData();
                widgetJson = raw != null ? raw.toString() : "{}";
            }

            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(
                    MassScheduleWidgetProvider.PREFS_NAME,
                    Context.MODE_PRIVATE
            );

            // Synchronously commit to ensure data is immediately available to RemoteViewsService
            prefs.edit().putString(MassScheduleWidgetProvider.KEY_WIDGET_DATA, widgetJson).commit();

            // Refresh all instances of the home screen widgets immediately
            MassScheduleWidgetProvider.updateAllWidgets(context);
            CompactMassWidgetProvider.updateAllWidgets(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update widget data: " + e.getMessage(), e);
        }
    }
}
