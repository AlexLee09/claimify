# Bok Seng Petty Cash System - TODO

## Database & Schema
- [x] Create receipts table with all required fields
- [x] Create batches table for grouping receipts
- [x] Create departments table for float management
- [x] Create staff table for user management
- [x] Push database migrations

## Backend API
- [x] Receipt CRUD operations (create, read, update status)
- [x] Batch creation and management endpoints
- [x] Department float tracking endpoints
- [x] Staff management endpoints
- [x] Receipt status transition logic

## AI Integration (Gemini)
- [x] Receipt image OCR extraction (merchant, date, amount, GST)
- [x] Policy violation detection (alcohol, old receipts, excessive amounts)
- [x] Category classification with confidence scoring
- [x] Handwritten Chinese text support
- [x] AI reasoning/explanation generation

## Staff View (Persona 1)
- [x] Department and name selector
- [x] Receipt image capture/upload
- [x] AI-extracted data verification form
- [x] Category selection (pre-filled by AI)
- [x] Project code input
- [x] Submit claim functionality
- [x] Recent submissions list with status badges

## Admin View (Persona 2)
- [x] Department selector
- [x] Float visualizer (progress bar showing remaining cash)
- [x] Kanban board with 3 columns (To Review, Auto-Sorted, Approved)
- [x] Receipt card with AI reason badges
- [x] Modal with zoomable receipt image and extracted data
- [x] Approve/Reject functionality with float impact preview
- [x] Create Top-Up Request (batch creation)

## HOD View (Persona 3)
- [x] Batch summary display
- [x] Category breakdown chart
- [x] Line item table with checkboxes
- [x] Selective rejection capability
- [x] Dynamic total calculation
- [x] Batch approval functionality

## Finance Director View (Persona 4)
- [x] Global queue of approved batches
- [x] Batch drill-down with GL coding
- [x] GST totals display
- [x] AI validation messages
- [x] Process Bank Transfer (disbursement)
- [x] Float reset functionality

## Global Navigation
- [x] Persona sidebar/top-nav for switching views
- [x] No authentication (God Mode)
- [x] Consistent layout across all views

## S3 Storage
- [x] Receipt image upload to S3
- [x] Secure URL generation for images

## Testing & Polish
- [x] Test complete workflow end-to-end
- [x] Error handling and loading states
- [x] Mobile responsiveness for Staff view

## Bug Fixes
- [x] Fix upload error: Cannot read properties of undefined (reading '0') in AI extraction
- [x] Fix AI extraction returning no choices from LLM API

## Polish Items
- [x] Dept admin can see top-up requests after sending them
- [x] Fix HOD dialog horizontal scroll issue
- [x] Add Bok Seng logo to top left of sidebar
- [x] Remove "Hackathon Demo Mode" text from sidebar
- [x] Add activity logging for rejected items visible to dept admin

- [x] Add more spacing between tab items in Admin view
- [x] Make receipt details dialog wider with vertical scroll (Admin view)
- [x] Make top-up request dialog much wider to fit all content (HOD view)
- [x] Remove text from sidebar branding, show only larger logo
- [x] Fix AI incorrectly flagging past dates as future (date comparison bug)
- [x] Make receipt details modal even wider to prevent content overlap
- [x] Fix category and date fields overlapping in receipt details modal
