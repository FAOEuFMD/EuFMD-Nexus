# RMT Data Visualization Enhancements

## Overview
This update enhances the Risk Monitoring Tool's results page with advanced data visualizations to provide a more comprehensive and intuitive risk assessment experience.

## Components Implemented

### 1. Risk Score Map
- Interactive choropleth map showing risk levels by country
- Target country highlighted in gray
- Source countries colored by risk level (green to red)
- Tooltips showing detailed risk information on hover

### 2. Disease Status Heatmap
- Visualizes disease status across all source countries
- Color intensity indicates disease prevalence
- Provides at-a-glance comparison across multiple diseases and countries

### 3. Pathway Effectiveness Radar Chart
- Shows effectiveness of different transmission pathways for each disease
- Radar visualization makes pathway comparisons intuitive
- Color-coded by disease for easy distinction

### 4. Enhanced Risk Pathway Chart
- Interactive stacked bar chart showing pathway contributions to risk
- Disease selector allows filtering by specific disease
- Shows detailed breakdown of risk factors by country and pathway

## Technologies Used
- Leaflet with react-leaflet for mapping
- Nivo data visualization library for charts
- Natural Earth Data for country boundaries (UN-approved source)

## How to Use

### Risk Map
The map provides a geographical overview of risk levels. The target country is shown in gray, while source countries are colored based on their risk level from green (low risk) to red (high risk). Hover over a country to see detailed risk information.

### Disease Status Heatmap
This visualization shows the disease status for each disease across all source countries. Darker colors indicate higher disease prevalence. This helps identify which diseases pose the greatest risk from which countries.

### Pathway Effectiveness Radar
The radar chart illustrates how effective each pathway is for transmitting different diseases. This helps understand which pathways are most critical to monitor for each disease.

### Risk Pathway Chart
The stacked bar chart breaks down risk contributions by pathway for each country. Use the disease selector buttons to filter by a specific disease and see how different pathways contribute to risk for that disease.

## Implementation Details
These visualizations are designed to work with the existing data structure and API endpoints, requiring no backend changes. They're implemented using React components that can be easily maintained and extended.
